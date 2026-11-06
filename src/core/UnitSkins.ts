import { z } from "zod";

// Append only: the enum order is also the wire value and atlas row.
export const UNIT_SKIN_IDS = [
  "flower-power",
  "warcraft",
  "default",
  "ff7-mako",
  "dragonball",
] as const;
export const UnitSkinSchema = z.enum(UNIT_SKIN_IDS);
export type UnitSkin = z.infer<typeof UnitSkinSchema>;
export const UNIT_SKIN_ROWS = UNIT_SKIN_IDS.length;

export function unitSkinRow(skin: UnitSkin | undefined): number {
  return skin === undefined ? 0 : Math.max(0, UNIT_SKIN_IDS.indexOf(skin));
}

export function unitSkinColumn(
  column: number,
  columns: number,
  skin?: UnitSkin,
): number {
  return column + unitSkinRow(skin) * columns;
}
