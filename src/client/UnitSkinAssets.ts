import { UnitType } from "../core/game/Game";
import { UnitSkin, UnitSkinSchema } from "../core/UnitSkins";

const STORAGE_KEY = "openfront.unitSkin";
let sessionSelection: UnitSkin | undefined;
export function savedUnitSkin(): UnitSkin {
  if (sessionSelection !== undefined) return sessionSelection;
  try {
    return (
      UnitSkinSchema.safeParse(localStorage.getItem(STORAGE_KEY)).data ??
      "flower-power"
    );
  } catch {
    return "flower-power";
  }
}
export function saveUnitSkin(skin: UnitSkin): void {
  try {
    localStorage.setItem(STORAGE_KEY, skin);
    sessionSelection = undefined;
  } catch {
    sessionSelection = skin;
  }
}
const files: Partial<Record<UnitType, string>> = {
  [UnitType.City]: "city",
  [UnitType.Port]: "port",
  [UnitType.Factory]: "factory",
  [UnitType.DefensePost]: "defensePost",
  [UnitType.SAMLauncher]: "samLauncher",
  [UnitType.MissileSilo]: "missileSilo",
  [UnitType.TransportShip]: "transportship",
  [UnitType.TradeShip]: "tradeship",
  [UnitType.Warship]: "warship",
  [UnitType.AtomBomb]: "atombomb",
  [UnitType.HydrogenBomb]: "hydrogenbomb",
  [UnitType.MIRV]: "mirv2",
  [UnitType.MIRVWarhead]: "mirvWarhead",
  [UnitType.SAMMissile]: "samMissile",
  [UnitType.Shell]: "shell",
};
const buildings = new Set([
  UnitType.City,
  UnitType.Port,
  UnitType.Factory,
  UnitType.DefensePost,
  UnitType.SAMLauncher,
  UnitType.MissileSilo,
]);
export function unitSkinIcon(
  type: UnitType,
  skin?: UnitSkin,
): string | undefined {
  const file = files[type];
  if (!file) return undefined;
  if (skin === "warcraft") return `skins/warcraft/${file}.png`;
  return buildings.has(type)
    ? `images/flower-power/${file}.png`
    : `sprites/${file}.png`;
}
