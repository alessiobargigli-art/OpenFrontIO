import { describe, expect, it, vi } from "vitest";
import {
  savedUnitSkin,
  saveUnitSkin,
  unitSkinIcon,
} from "../src/client/UnitSkinAssets";
import { UnitType } from "../src/core/game/Game";
import {
  UNIT_SKIN_IDS,
  UNIT_SKIN_ROWS,
  unitSkinColumn,
  unitSkinRow,
} from "../src/core/UnitSkins";
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeClientMessage,
  encodeServerMessage,
} from "../src/core/ZbinWire";
import { ClientMsgRateLimiter } from "../src/server/ClientMsgRateLimiter";

describe("built-in skin contract", () => {
  it("keeps old and absent selections in the exact original atlas row", () => {
    expect(UNIT_SKIN_ROWS).toBe(3);
    for (let c = 0; c < 12; c++) {
      expect(unitSkinColumn(c, 12)).toBe(c);
      expect(unitSkinColumn(c, 12, "flower-power")).toBe(c);
      expect(unitSkinColumn(c, 12, "warcraft")).toBe(c + 12);
      expect(unitSkinColumn(c, 12, "default")).toBe(c + 24);
    }
    expect(unitSkinRow("warcraft")).toBe(1);
    expect(unitSkinColumn(5, 6, "warcraft")).toBe(11);
  });
  it("persists only known selections and handles corrupt saved preferences", () => {
    localStorage.clear();
    expect(savedUnitSkin()).toBe("flower-power");
    saveUnitSkin("warcraft");
    expect(savedUnitSkin()).toBe("warcraft");
    localStorage.setItem("openfront.unitSkin", "../../custom");
    expect(savedUnitSkin()).toBe("flower-power");
    localStorage.clear();
  });
  it("maps UI icons to bounded local assets", () => {
    expect(unitSkinIcon(UnitType.City, "warcraft")).toBe(
      "skins/warcraft/city.png",
    );
    expect(unitSkinIcon(UnitType.MIRV, "warcraft")).toBe(
      "skins/warcraft/mirv2.png",
    );
    expect(unitSkinIcon(UnitType.City, "default")).toBe(
      "skins/default/city.png",
    );
    expect(unitSkinIcon(UnitType.AtomBomb, "default")).toBe(
      "skins/default/atombomb.png",
    );
    expect(unitSkinIcon(UnitType.City)).toBe("images/flower-power/city.png");
    expect(unitSkinIcon(UnitType.AtomBomb)).toBe("sprites/atombomb.png");
  });
  it.each(UNIT_SKIN_IDS)("round trips both socket directions: %s", (skin) => {
    const request = { type: "unit_skin" as const, skin };
    const response = { type: "unit_skin" as const, skin, accepted: true };
    expect(
      decodeClientMessage(encodeClientMessage(request, undefined), undefined),
    ).toEqual(request);
    expect(
      decodeServerMessage(encodeServerMessage(response, undefined), undefined),
    ).toEqual(response);
  });
  it("rate limits broadcast-producing selection changes", () => {
    const limiter = new ClientMsgRateLimiter();
    for (let i = 0; i < 10; i++)
      expect(limiter.check("player01", "unit_skin", 16)).toBe("ok");
    expect(limiter.check("player01", "unit_skin", 16)).toBe("limit");
  });
});

it("keeps singleplayer selection in memory when browser storage rejects writes", () => {
  const storage = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("quota");
    });
  try {
    saveUnitSkin("warcraft");
    expect(savedUnitSkin()).toBe("warcraft");
  } finally {
    storage.mockRestore();
    saveUnitSkin("flower-power");
    localStorage.clear();
  }
});
