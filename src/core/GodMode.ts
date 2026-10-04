import {
  Game,
  GameType,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "./game/Game";
import type { GameConfig } from "./Schemas";

// generateID() omits O and 0, so this cannot collide with a normal player.
export const GOD_PLAYER_ID = "GOD00000";
export const GOD_WEAPONS = [
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRV,
] as const;
export type GodWeapon = (typeof GOD_WEAPONS)[number];

export function godModeEnabled(config: GameConfig): boolean {
  return (
    config.godMode !== false &&
    config.gameType !== GameType.Public &&
    config.rankedType === undefined
  );
}

export function getGodPlayer(game: Game): Player {
  const existing = game.allPlayers().find((p) => p.id() === GOD_PLAYER_ID);
  return (
    existing ??
    game.addPlayer(
      new PlayerInfo("God Spectator", PlayerType.Nation, null, GOD_PLAYER_ID),
    )
  );
}

export function godLaunchTile(game: Game, target: number): number {
  return game.ref(
    game.x(target),
    game.y(target) < game.height() / 2 ? game.height() - 1 : 0,
  );
}
