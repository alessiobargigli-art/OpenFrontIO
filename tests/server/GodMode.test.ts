import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { UnitType } from "../../src/core/game/Game";
import { isGodSpectator } from "../../src/core/GodMode";
import { GameStartInfo } from "../../src/core/Schemas";
import { createGameWireContext } from "../../src/core/ZbinWire";
import {
  makeClient,
  makeGame,
  mockWsOf,
  startGame,
} from "../util/GameServerHarness";

describe("God spectator authorization", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  function lobby(godMode?: boolean) {
    const host = makeClient({ clientID: "host0001" });
    const guest = makeClient({ clientID: "guest001", spectator: true });
    const observer = makeClient({ clientID: "watch001", spectator: true });
    const game = makeGame({
      creatorPersistentID: host.persistentID,
      config: { godMode },
    });
    for (const c of [host, guest, observer])
      expect(game.joinClient(c)).toBe("joined");
    return { game, host, guest, observer };
  }
  function startInfo(client: ReturnType<typeof makeClient>): GameStartInfo {
    const start = mockWsOf(client)
      .sent()
      .find((m) => m.type === "start");
    if (start?.type !== "start") throw Error("not started");
    return start.gameStartInfo;
  }
  const command = {
    type: "intent" as const,
    intent: {
      type: "god_launch" as const,
      weapon: UnitType.MIRV as const,
      tile: 55,
    },
  };
  test("playing owner enables mode; every spectator fires without grants and gets controls", async () => {
    const { game, host, guest, observer } = lobby(false);
    await mockWsOf(host).emit({
      type: "intent",
      intent: { type: "update_game_config", config: { godMode: true } },
    });
    expect(game.gameConfig.godMode).toBe(true);
    startGame(game);
    const start = startInfo(host);
    expect(start.players.map((p) => p.clientID)).toEqual([host.clientID]);
    expect(host.spectator).toBe(false);
    expect(isGodSpectator(start, host.clientID)).toBe(false);
    expect(isGodSpectator(start, guest.clientID)).toBe(true);
    expect(isGodSpectator(start, observer.clientID)).toBe(true);
    await mockWsOf(host).emit(command);
    await mockWsOf(guest).emit(command);
    await mockWsOf(observer).emit(command);
    vi.advanceTimersByTime(250);
    const ctx = createGameWireContext(start.players);
    const launched = mockWsOf(host)
      .sent(ctx)
      .filter((m) => m.type === "turn")
      .flatMap((m) => (m.type === "turn" ? m.turn.intents : []))
      .filter((i) => i.type === "god_launch");
    expect(launched.map((i) => i.clientID)).toEqual([
      guest.clientID,
      observer.clientID,
    ]);
  });
  test.each([undefined, false])(
    "default enables every spectator; disabled denies everyone (%s)",
    (enabled) => {
      const { game, host, guest, observer } = lobby(enabled);
      startGame(game);
      const start = startInfo(host);
      for (const c of [host, guest, observer]) {
        const actor = {
          clientID: c.clientID,
          isLobbyCreator: c === host,
          isAdmin: false,
          isAdminBot: false,
        };
        const allowed = c !== host && enabled !== false;
        expect(game.handleIntent(command.intent, actor).status).toBe(
          allowed ? 200 : 403,
        );
        expect(isGodSpectator(start, c.clientID)).toBe(allowed);
      }
      expect(isGodSpectator(start, undefined)).toBe(false);
      expect(
        game.handleIntent(command.intent, {
          clientID: "unknown1",
          isLobbyCreator: false,
          isAdmin: false,
          isAdminBot: false,
        }).status,
      ).toBe(403);
    },
  );
  test("only the owner can disable mode; spectators cannot enable it or send normal gameplay", async () => {
    const { game, host, guest } = lobby();
    await mockWsOf(host).emit({
      type: "intent",
      intent: { type: "update_game_config", config: { godMode: false } },
    });
    expect(game.gameConfig.godMode).toBe(false);
    await mockWsOf(guest).emit({
      type: "intent",
      intent: { type: "update_game_config", config: { godMode: true } },
    });
    expect(game.gameConfig.godMode).toBe(false);
    startGame(game);
    const start = startInfo(host);
    await mockWsOf(guest).emit(command);
    await mockWsOf(guest).emit({
      type: "intent",
      intent: { type: "spawn", tile: 10 },
    });
    vi.advanceTimersByTime(250);
    const ctx = createGameWireContext(start.players);
    const intents = mockWsOf(host)
      .sent(ctx)
      .filter((m) => m.type === "turn")
      .flatMap((m) => (m.type === "turn" ? m.turn.intents : []));
    expect(
      intents.some((i) => i.type === "god_launch" || i.type === "spawn"),
    ).toBe(false);
  });
  test.each([true, false])(
    "late arrivals seated as spectators immediately get God commands and controls (requested spectator: %s)",
    async (spectator) => {
      const { game, host } = lobby();
      startGame(game);
      vi.advanceTimersByTime(5000);
      const late = makeClient({ clientID: "late0001", spectator });
      expect(game.joinClient(late)).toBe("joined");
      expect(late.spectator).toBe(true);
      const start = startInfo(late);
      expect(isGodSpectator(start, late.clientID)).toBe(true);
      await mockWsOf(late).emit(command);
      vi.advanceTimersByTime(250);
      const ctx = createGameWireContext(start.players);
      const intents = mockWsOf(host)
        .sent(ctx)
        .filter((m) => m.type === "turn")
        .flatMap((m) => (m.type === "turn" ? m.turn.intents : []));
      expect(
        intents.filter((i) => i.type === "god_launch").map((i) => i.clientID),
      ).toEqual([late.clientID]);
    },
  );
});
