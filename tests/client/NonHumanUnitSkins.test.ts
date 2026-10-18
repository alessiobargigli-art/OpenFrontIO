import { afterEach, describe, expect, it } from "vitest";
import { saveUnitSkin } from "../../src/client/UnitSkinAssets";
import { PlayerType } from "../../src/core/game/Game";
import { GameUpdateType } from "../../src/core/game/GameUpdates";
import { UserSettings } from "../../src/core/game/UserSettings";
import { makeEmptyGu, makeGameView, makePlayerUpdate } from "../util/viewStubs";

afterEach(() => {
  localStorage.clear();
  new UserSettings().setGraphicsOverrides({});
});

describe("AI uses the viewer's base unit pack", () => {
  it.each(["warcraft", "default"] as const)(
    "uses accepted %s without replacing human choices or nation flags",
    (skin) => {
      saveUnitSkin("flower-power");
      const game = makeGameView({
        myClientID: "me",
        humans: [
          { clientID: "me", cosmetics: { unitSkin: skin } },
          { clientID: "enemy", cosmetics: { unitSkin: "flower-power" } },
        ] as never,
      });
      const gu = makeEmptyGu(1);
      gu.updates[GameUpdateType.Player] = [
        makePlayerUpdate({
          id: "bot",
          smallID: 2,
          clientID: null,
          playerType: PlayerType.Bot,
        }),
        makePlayerUpdate({
          id: "nation",
          smallID: 3,
          clientID: null,
          playerType: PlayerType.Nation,
          nationFlag: "US",
        }),
        makePlayerUpdate({ id: "human", smallID: 4, clientID: "enemy" }),
      ];
      game.update(gu);
      expect(game.player("bot").cosmetics.unitSkin).toBe(skin);
      expect(game.player("nation").cosmetics.unitSkin).toBe(skin);
      expect(game.player("nation").cosmetics.flag).toBe("/flags/US.svg");
      expect(game.player("human").cosmetics.unitSkin).toBe("flower-power");
      // Changing the preference outside the match doesn't change its accepted pack.
      saveUnitSkin("warcraft");
      game.refreshPlayerCosmetics();
      expect(game.player("bot").cosmetics.unitSkin).toBe(skin);
      new UserSettings().setGraphicsOverrides({
        cosmetics: { showFrom: "self" },
      });
      game.refreshPlayerCosmetics();
      expect(game.player("bot").cosmetics.unitSkin).toBeUndefined();
    },
  );

  it("freezes the spectator's selected theme for AI and God", () => {
    saveUnitSkin("default");
    const game = makeGameView({ myClientID: "spectator" });
    saveUnitSkin("warcraft");
    expect(game.nonHumanUnitSkin()).toBe("default");
  });
});
