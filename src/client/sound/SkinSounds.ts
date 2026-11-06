import { assetUrl } from "../../core/AssetUrls";
import type { UnitSkin } from "../../core/UnitSkins";
import type { SoundEffect } from "./Sounds";

/** Unit cues only: alerts, chat and UI retain their familiar meaning. */
export const SKIN_SOUND_EFFECTS = [
  "atom-launch",
  "hydrogen-launch",
  "mirv-launch",
  "atom-hit",
  "hydrogen-hit",
  "build-city",
  "build-port",
  "build-defense-post",
  "build-warship",
  "sam-built",
  "silo-built",
  "build-factory",
  "build-train-station",
  "transport-ship",
] as const satisfies readonly SoundEffect[];

const themedCues: ReadonlySet<SoundEffect> = new Set(SKIN_SOUND_EFFECTS);

export function skinSoundUrl(
  effect: SoundEffect,
  skin: UnitSkin | undefined,
): string | undefined {
  if (!skin || skin === "default" || !themedCues.has(effect)) return undefined;
  return assetUrl(`sounds/skins/${skin}/${effect}.mp3`);
}
