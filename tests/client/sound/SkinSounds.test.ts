import { readFileSync, statSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { SoundEffectController } from "../../../src/client/controllers/SoundEffectController";
import {
  SKIN_SOUND_EFFECTS,
  skinSoundUrl,
} from "../../../src/client/sound/SkinSounds";
import { PlaySoundEffectEvent } from "../../../src/client/sound/Sounds";
import { saveUnitSkin } from "../../../src/client/UnitSkinAssets";
import { EventBus } from "../../../src/core/EventBus";
import { PlayerType, UnitType } from "../../../src/core/game/Game";
import { GameUpdateType } from "../../../src/core/game/GameUpdates";
import { UserSettings } from "../../../src/core/game/UserSettings";
import {
  makeEmptyGu,
  makeGameView,
  makePlayerUpdate,
  makeUnitUpdate,
} from "../../util/viewStubs";

afterEach(() => {
  new UserSettings().setGraphicsOverrides({});
  saveUnitSkin("flower-power");
});

describe("skin sound assets", () => {
  it.each(["flower-power", "warcraft", "ff7-mako", "dragonball"] as const)(
    "ships the complete %s pack with distinct MP3 data",
    (skin) => {
      const data = SKIN_SOUND_EFFECTS.map((effect) => {
        const path = `sounds/skins/${skin}/${effect}.mp3`;
        expect(skinSoundUrl(effect, skin)).toContain(path);
        expect(statSync(`resources/${path}`).size).toBeGreaterThan(1000);
        return readFileSync(`resources/${path}`).toString("base64");
      });
      expect(new Set(data).size).toBe(SKIN_SOUND_EFFECTS.length);
    },
  );

  it("keeps default, absent skins, UI and warning cues on the standard registry", () => {
    expect(skinSoundUrl("atom-hit", "default")).toBeUndefined();
    expect(skinSoundUrl("atom-hit", undefined)).toBeUndefined();
    expect(skinSoundUrl("click", "dragonball")).toBeUndefined();
    expect(skinSoundUrl("nuke-warning", "warcraft")).toBeUndefined();
  });
});

describe("visible owner skins on real view updates", () => {
  function scenario(spectator = false) {
    saveUnitSkin("ff7-mako");
    const game = makeGameView({
      myClientID: spectator ? "spectator" : "self",
      humans: [
        { clientID: "self", cosmetics: { unitSkin: "dragonball" } },
        { clientID: "enemy", cosmetics: { unitSkin: "warcraft" } },
      ] as never,
    });
    const initial = makeEmptyGu(1);
    initial.updates[GameUpdateType.Player] = [
      makePlayerUpdate({ id: "self-player", smallID: 1, clientID: "self" }),
      makePlayerUpdate({ id: "enemy-player", smallID: 2, clientID: "enemy" }),
      makePlayerUpdate({
        id: "bot",
        smallID: 3,
        clientID: null,
        playerType: PlayerType.Bot,
      }),
    ];
    game.update(initial);
    const bus = new EventBus();
    const played: PlaySoundEffectEvent[] = [];
    bus.on(PlaySoundEffectEvent, (e) => played.push(e));
    const controller = new SoundEffectController(game, bus);
    let tick = 1;
    function create(id: number, ownerID: number, unitType = UnitType.AtomBomb) {
      const update = makeEmptyGu((tick += 3));
      update.updates[GameUpdateType.Unit] = [
        makeUnitUpdate({ id, ownerID, unitType }),
      ];
      game.update(update);
      controller.tick();
    }
    return { game, played, create, controller };
  }

  it("uses own, enemy and bot skins independently for launches and impacts", () => {
    const { game, played, create, controller } = scenario();
    create(1, 1);
    create(2, 2, UnitType.HydrogenBomb);
    create(3, 3, UnitType.MIRV);
    expect(played.map((e) => e.unitSkin)).toEqual([
      "dragonball",
      "warcraft",
      "dragonball",
    ]);
    const update = makeEmptyGu(11);
    update.updates[GameUpdateType.Unit] = [
      makeUnitUpdate({
        id: 2,
        ownerID: 2,
        unitType: UnitType.HydrogenBomb,
        isActive: false,
        reachedTarget: true,
      }),
    ];
    game.update(update);
    controller.tick();
    expect(played[played.length - 1]).toEqual(
      new PlaySoundEffectEvent("hydrogen-hit", "warcraft"),
    );
  });

  it("follows the spectator theme for bots and visible human choices for opponents", () => {
    const { played, create } = scenario(true);
    create(1, 3);
    create(2, 2);
    expect(played.map((e) => e.unitSkin)).toEqual(["ff7-mako", "warcraft"]);
  });

  it("follows hidden cosmetics rather than leaking the equipped enemy theme", () => {
    const { game, played, create } = scenario();
    new UserSettings().setGraphicsOverrides({
      cosmetics: { showFrom: "self" },
    });
    game.refreshPlayerCosmetics();
    create(1, 2);
    expect(played[0].unitSkin).toBe("flower-power");
  });

  it("themes own construction while enemy construction stays silent", () => {
    const { played, create } = scenario();
    create(1, 1, UnitType.City);
    create(2, 2, UnitType.Factory);
    expect(played).toEqual([
      new PlaySoundEffectEvent("build-city", "dragonball"),
    ]);
  });
});
