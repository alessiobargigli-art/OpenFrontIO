import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientUnitSkinMessageSchema } from "../../src/core/Schemas";
import { makeClient, makeGame, mockWsOf } from "../util/GameServerHarness";

describe("built-in unit skins in the lobby", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  function setup(anonymizeNames = false) {
    const host = makeClient({ username: "Host" });
    const player = makeClient({
      username: "Alice",
      cosmetics: { verified: true, skin: { name: "paid", url: "/paid.png" } },
    });
    const game = makeGame({
      creatorPersistentID: host.persistentID,
      config: { anonymizeNames },
    });
    game.joinClient(host);
    game.joinClient(player);
    mockWsOf(host).send.mockClear();
    mockWsOf(player).send.mockClear();
    return { game, host, player };
  }
  it.each(["warcraft", "default"] as const)(
    "broadcasts %s only for the sender without changing account cosmetics",
    async (skin) => {
      const { game, host, player } = setup();
      await mockWsOf(player).emit({ type: "unit_skin", skin });
      expect(player.cosmetics).toEqual({
        verified: true,
        skin: { name: "paid", url: "/paid.png" },
        unitSkin: skin,
      });
      expect(host.cosmetics?.unitSkin).toBeUndefined();
      expect(mockWsOf(player).sent()[0]).toEqual({
        type: "unit_skin",
        accepted: true,
        skin,
      });
      const lobby = mockWsOf(host)
        .sent()
        .find((m) => m.type === "lobby_info");
      expect(
        lobby?.type === "lobby_info" &&
          lobby.lobby.clients?.find((c) => c.clientID === player.clientID)
            ?.unitSkin,
      ).toBe(skin);
      game.prestart();
      game.start();
      const start = mockWsOf(host)
        .sent()
        .find((m) => m.type === "start");
      expect(
        start?.type === "start" &&
          start.gameStartInfo.players.find(
            (p) => p.clientID === player.clientID,
          )?.cosmetics?.unitSkin,
      ).toBe(skin);
    },
  );
  it("lets a guest host with no cosmetics choose and switch back", async () => {
    const { host } = setup();
    await mockWsOf(host).emit({ type: "unit_skin", skin: "warcraft" });
    expect(host.cosmetics?.unitSkin).toBe("warcraft");
    await mockWsOf(host).emit({ type: "unit_skin", skin: "flower-power" });
    expect(host.cosmetics?.unitSkin).toBe("flower-power");
  });
  it("refuses changes from prestart, retaining the accepted choice", async () => {
    const { game, player } = setup();
    await mockWsOf(player).emit({ type: "unit_skin", skin: "warcraft" });
    game.prestart();
    await mockWsOf(player).emit({ type: "unit_skin", skin: "flower-power" });
    expect(player.cosmetics?.unitSkin).toBe("warcraft");
    expect(
      mockWsOf(player)
        .sent()
        .filter((m) => m.type === "unit_skin")
        .slice(-1)[0],
    ).toEqual({ type: "unit_skin", accepted: false, skin: "warcraft" });
  });
  it("keeps appearance hidden from anonymized opponents", async () => {
    const { game, host, player } = setup(true);
    await mockWsOf(player).emit({ type: "unit_skin", skin: "warcraft" });
    expect(
      game
        .gameInfo(host.clientID)
        .clients?.find((p) => p.clientID === player.clientID)?.unitSkin,
    ).toBeUndefined();
    expect(
      game
        .gameInfo(player.clientID)
        .clients?.find((p) => p.clientID === player.clientID)?.unitSkin,
    ).toBe("warcraft");
  });
  it("ignores messages left on a disconnected socket", async () => {
    const { player } = setup();
    await mockWsOf(player).trigger("close");
    await mockWsOf(player).emit({ type: "unit_skin", skin: "warcraft" });
    expect(player.cosmetics?.unitSkin).toBeUndefined();
  });
  it.each(["https://evil.test/atlas.png", "unknown", "../warcraft"])(
    "rejects an arbitrary skin reference: %s",
    (skin) => {
      expect(
        ClientUnitSkinMessageSchema.safeParse({ type: "unit_skin", skin })
          .success,
      ).toBe(false);
    },
  );
});
