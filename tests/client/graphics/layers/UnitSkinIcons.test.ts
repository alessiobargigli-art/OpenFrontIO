import { render } from "lit";
import { afterEach, describe, expect, it } from "vitest";
import { BuildMenu } from "../../../../src/client/hud/layers/BuildMenu";
import { columnById } from "../../../../src/client/hud/layers/lib/StatsColumns";
import { PlayerInfoOverlay } from "../../../../src/client/hud/layers/PlayerInfoOverlay";
import { PlayerStats } from "../../../../src/client/hud/layers/PlayerStats";
import { UnitDisplay } from "../../../../src/client/hud/layers/UnitDisplay";
import { saveUnitSkin } from "../../../../src/client/UnitSkinAssets";
import { UnitType } from "../../../../src/core/game/Game";
import { UNIT_SKIN_IDS } from "../../../../src/core/UnitSkins";

const target = () => document.createElement("div");
const iconPaths = (el: Element) =>
  [...el.querySelectorAll("img")].map((img) => img.getAttribute("src"));
const player = (unitSkin: (typeof UNIT_SKIN_IDS)[number] | undefined) => ({
  cosmetics: { unitSkin },
  isAlive: () => true,
  gold: () => 10_000n,
  units: () => [1],
  totalUnitLevels: () => 3,
});
const game = (skin: (typeof UNIT_SKIN_IDS)[number] | undefined) => ({
  myPlayer: () => player(skin),
  config: () => ({ isUnitDisabled: () => false }),
  inSpawnPhase: () => false,
});

afterEach(() => {
  localStorage.clear();
});

describe("unit skin icons in real HUD templates", () => {
  it.each(["warcraft", "default"] as const)(
    "uses accepted %s in the hotbar and build menu",
    (skin) => {
      // A stale local preference must not override what this match accepted.
      saveUnitSkin("flower-power");
      const hotbar = new UnitDisplay();
      hotbar.game = game(skin) as never;
      hotbar.uiState = { ghostStructure: null } as never;
      const root = target();
      render(hotbar.render(), root);
      for (const file of [
        "city",
        "port",
        "factory",
        "defensePost",
        "missileSilo",
        "samLauncher",
        "warship",
        "atombomb",
        "hydrogenbomb",
        "mirv2",
      ])
        expect(iconPaths(root)).toContain(`/skins/${skin}/${file}.png`);

      const menu = new BuildMenu();
      menu.game = game(skin) as never;
      menu.playerBuildables = [
        {
          type: UnitType.City,
          cost: 100n,
          canBuild: 1,
          canUpgrade: false,
          overlappingRailroads: [],
          ghostRailPaths: [],
        },
      ];
      render(menu.render(), root);
      expect(iconPaths(root)).toContain(`/skins/${skin}/city.png`);
      expect(iconPaths(root).some((src) => src?.includes("flower-power"))).toBe(
        false,
      );
    },
  );

  it("uses the inspected opponent's visible skin, including hidden/absent cosmetics", () => {
    const overlay = new PlayerInfoOverlay();
    overlay.game = game("warcraft") as never;
    const root = target();
    for (const skin of ["default", "warcraft", undefined] as const) {
      render(
        (overlay as any).displayUnitCount(player(skin), UnitType.City),
        root,
      );
      expect(iconPaths(root)).toEqual([
        skin ? `/skins/${skin}/city.png` : "/images/flower-power/city.png",
      ]);
      expect(root.textContent).toContain("3");
    }
  });

  it("updates statistics headers without mutating the shared registry", () => {
    const table = new PlayerStats();
    const column = columnById("cities");
    const original = column.headerVisual;
    const root = target();
    for (const skin of ["warcraft", "default"] as const) {
      table.game = game(skin) as never;
      render((table as any).renderHeaderVisual(column, "Cities"), root);
      expect(iconPaths(root)).toEqual([`/skins/${skin}/city.png`]);
    }
    table.game = game(undefined) as never;
    saveUnitSkin("warcraft");
    render((table as any).renderHeaderVisual(column, "Cities"), root);
    expect(iconPaths(root)).toEqual(["/images/flower-power/city.png"]);
    expect(column.headerVisual).toBe(original);
  });
});
