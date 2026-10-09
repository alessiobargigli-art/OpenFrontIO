import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientLobbyRenameMessageSchema } from "../../src/core/Schemas";
import { createGameWireContext } from "../../src/core/ZbinWire";
import { censorPlayer } from "../../src/server/Censor";
import {
  makeClient,
  makeGame,
  mockWsOf,
  startGame,
} from "../util/GameServerHarness";

describe("lobby rename over the binary socket", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup(spectator = false, anonymizeNames = false) {
    const actor = makeClient({
      username: "OldName",
      clanTag: "SUN",
      spectator,
      cosmetics: { verified: true },
    });
    const observer = makeClient({ username: "Observer" });
    const game = makeGame({
      creatorPersistentID: observer.persistentID,
      config: { anonymizeNames },
    });
    game.joinClient(observer);
    game.joinClient(actor);
    mockWsOf(actor).send.mockClear();
    mockWsOf(observer).send.mockClear();
    return { game, actor, observer };
  }

  it.each([false, true])(
    "renames only the connected sender (spectator=%s) and broadcasts immediately",
    async (spectator) => {
      const { game, actor, observer } = setup(spectator);
      const originalID = actor.clientID;
      await mockWsOf(actor).emit({
        type: "lobby_rename",
        username: "  Flower Child  ",
      });
      expect(actor.username).toBe("Flower Child");
      expect(actor.clientID).toBe(originalID);
      expect(actor.clanTag).toBe("SUN");
      expect(actor.spectator).toBe(spectator);
      expect(actor.cosmetics?.verified).toBeUndefined();
      expect(observer.username).toBe("Observer");
      expect(mockWsOf(actor).sent()[0]).toEqual({
        type: "lobby_rename",
        accepted: true,
        username: "Flower Child",
        clanTag: "SUN",
      });
      const update = mockWsOf(observer)
        .sent()
        .find((m) => m.type === "lobby_info");
      expect(
        update?.type === "lobby_info" &&
          update.lobby.clients?.find((c) => c.clientID === actor.clientID)
            ?.username,
      ).toBe("Flower Child");
      expect(game.numClients()).toBe(2);
    },
  );

  it("allows the lobby host to rename without changing ownership", async () => {
    const { game, observer } = setup();
    await mockWsOf(observer).emit({
      type: "lobby_rename",
      username: "Peace Keeper",
    });
    expect(game.gameInfo().lobbyCreatorClientID).toBe(observer.clientID);
    expect(observer.username).toBe("Peace Keeper");
  });

  it("applies the same profanity censor as joining", async () => {
    const { actor } = setup();
    const expected = censorPlayer("fuck", actor.clanTag);
    await mockWsOf(actor).emit({ type: "lobby_rename", username: "fuck" });
    expect(actor.username).toBe(expected.username);
    expect(actor.username).not.toBe("fuck");
    expect(mockWsOf(actor).sent()[0]).toMatchObject({
      accepted: true,
      username: expected.username,
    });
  });

  it("retains verification when the actual name is unchanged", async () => {
    const { actor } = setup();
    await mockWsOf(actor).emit({ type: "lobby_rename", username: "OldName" });
    expect(actor.cosmetics?.verified).toBe(true);
  });

  it("preserves anonymization for other participants", async () => {
    const { actor, observer } = setup(false, true);
    await mockWsOf(actor).emit({
      type: "lobby_rename",
      username: "Hidden Flower",
    });
    const update = mockWsOf(observer)
      .sent()
      .find((m) => m.type === "lobby_info");
    expect(update?.type).toBe("lobby_info");
    if (update?.type !== "lobby_info") throw new Error("missing lobby update");
    expect(
      update.lobby.clients?.find((c) => c.clientID === actor.clientID)
        ?.username,
    ).not.toBe("Hidden Flower");
    expect(mockWsOf(actor).sent()[0]).toMatchObject({
      username: "Hidden Flower",
    });
  });

  it("refuses rename from the beginning of prestart and freezes the new name into game start", async () => {
    const { game, actor } = setup();
    await mockWsOf(actor).emit({
      type: "lobby_rename",
      username: "Flower Child",
    });
    game.prestart();
    await mockWsOf(actor).emit({ type: "lobby_rename", username: "Too Late" });
    expect(actor.username).toBe("Flower Child");
    expect(
      mockWsOf(actor)
        .sent()
        .filter((m) => m.type === "lobby_rename")
        .slice(-1)[0],
    ).toMatchObject({ accepted: false });
    game.start();
    const start = mockWsOf(actor)
      .sent()
      .find((m) => m.type === "start");
    expect(
      start?.type === "start" &&
        start.gameStartInfo.players.find((p) => p.clientID === actor.clientID)
          ?.username,
    ).toBe("Flower Child");
  });

  it("refuses rename after the game starts", async () => {
    const { game, actor } = setup();
    startGame(game);
    mockWsOf(actor).send.mockClear();
    await mockWsOf(actor).emit({ type: "lobby_rename", username: "Too Late" });
    const ctx = createGameWireContext(game.activeClients());
    expect(mockWsOf(actor).sent(ctx)[0]).toMatchObject({
      accepted: false,
      username: "OldName",
    });
  });

  it("ignores a stale socket after disconnect", async () => {
    const { actor } = setup();
    await mockWsOf(actor).trigger("close");
    await mockWsOf(actor).emit({
      type: "lobby_rename",
      username: "Ghost Name",
    });
    expect(actor.username).toBe("OldName");
  });

  it.each(["", "ab", "  a", "   ", "a".repeat(21), "<script>", "Flower🌼"])(
    "rejects invalid name %j at the wire boundary",
    (username) => {
      expect(
        ClientLobbyRenameMessageSchema.safeParse({
          type: "lobby_rename",
          username,
        }).success,
      ).toBe(false);
    },
  );
});
