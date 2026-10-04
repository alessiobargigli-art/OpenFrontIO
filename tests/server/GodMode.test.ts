import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { UnitType } from "../../src/core/game/Game";
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
    const host = makeClient({ clientID: "host0001", spectator: true });
    const guest = makeClient({ clientID: "guest001", spectator: true });
    const victim = makeClient({ clientID: "human001" });
    const game = makeGame({
      creatorPersistentID: host.persistentID,
      config: { godMode },
    });
    for (const c of [host, guest, victim])
      expect(game.joinClient(c)).toBe("joined");
    return { game, host, guest, victim };
  }
  test("spectating host can configure grants and start; ungranted observers cannot fire", async () => {
    const { game, host, guest, victim } = lobby();
    await mockWsOf(host).emit({
      type: "intent",
      intent: {
        type: "update_game_config",
        config: { godSpectators: [guest.clientID] },
      },
    });
    expect(game.gameConfig.godSpectators).toEqual([guest.clientID]);
    startGame(game);
    const start = mockWsOf(host)
      .sent()
      .find((m) => m.type === "start");
    expect(start?.type).toBe("start");
    if (start?.type !== "start") throw Error("not started");
    expect(start.gameStartInfo.players.map((p) => p.clientID)).toEqual([
      victim.clientID,
    ]);
    expect(start.gameStartInfo.config.godSpectators).toEqual([
      host.clientID,
      guest.clientID,
    ]);
    const ctx = createGameWireContext(start.gameStartInfo.players);
    const command = {
      type: "intent" as const,
      intent: {
        type: "god_launch" as const,
        weapon: UnitType.MIRV as const,
        tile: 55,
      },
    };
    await mockWsOf(host).emit(command);
    await mockWsOf(guest).emit(command);
    await mockWsOf(victim).emit(command);
    vi.advanceTimersByTime(250);
    const launched = mockWsOf(host)
      .sent(ctx)
      .filter((m) => m.type === "turn")
      .flatMap((m) => (m.type === "turn" ? m.turn.intents : []))
      .filter((i) => i.type === "god_launch");
    expect(launched.map((i) => i.clientID)).toEqual([
      host.clientID,
      guest.clientID,
    ]);
  });
  test.each([undefined, false])(
    "only host gets the default permission; disabled mode denies everyone (%s)",
    async (enabled) => {
      const { game, host, guest } = lobby(enabled);
      startGame(game);
      const intent = {
        type: "god_launch" as const,
        weapon: UnitType.AtomBomb as const,
        tile: 12,
      };
      const actor = (c: typeof host) => ({
        clientID: c.clientID,
        isLobbyCreator: c === host,
        isAdmin: false,
        isAdminBot: false,
      });
      expect(game.handleIntent(intent, actor(host)).status).toBe(
        enabled === false ? 403 : 200,
      );
      expect(game.handleIntent(intent, actor(guest)).status).toBe(403);
    },
  );
  test("observer cannot grant itself God permission or send normal gameplay", async () => {
    const { game, guest } = lobby();
    await mockWsOf(guest).emit({
      type: "intent",
      intent: {
        type: "update_game_config",
        config: { godSpectators: [guest.clientID] },
      },
    });
    expect(game.gameConfig.godSpectators).toBeUndefined();
    startGame(game);
    await mockWsOf(guest).emit({
      type: "intent",
      intent: { type: "spawn", tile: 10 },
    });
    expect(
      (game as unknown as { intents: { type: string }[] }).intents.some(
        (i) => i.type === "spawn",
      ),
    ).toBe(false);
  });
});
