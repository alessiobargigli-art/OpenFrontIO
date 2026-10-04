import { z } from "zod";
import {
  getGodPlayer,
  GOD_PLAYER_ID,
  GOD_WEAPONS,
  godLaunchTile,
  GodWeapon,
} from "../GodMode";
import { Execution, Game, UnitType } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type { ExecRecord, SnapshotReader } from "../snapshot/SnapshotContext";
import { MirvExecution } from "./MIRVExecution";
import { NukeExecution } from "./NukeExecution";

export function godMirvBusy(game: Game): boolean {
  return game
    .executions()
    .some(
      (exec) =>
        exec.isActive() &&
        (exec instanceof MirvExecution ||
          (exec instanceof NukeExecution &&
            exec.weaponType() === UnitType.MIRVWarhead)) &&
        exec.owner()?.id() === GOD_PLAYER_ID,
    );
}

// Queued separately so two requests in the same turn see the same MIRV lock.
export class GodLaunchExecution implements Execution {
  private active = true;
  private game: Game;
  constructor(
    private weapon: GodWeapon,
    private tile: number,
  ) {}
  init(game: Game): void {
    this.game = game;
  }
  tick(): void {
    this.active = false;
    if (this.weapon === UnitType.MIRV && godMirvBusy(this.game)) return;
    const player = getGodPlayer(this.game);
    this.game.addExecution(
      this.weapon === UnitType.MIRV
        ? new MirvExecution(player, this.tile)
        : new NukeExecution(
            this.weapon,
            player,
            this.tile,
            godLaunchTile(this.game, this.tile),
          ),
    );
  }
  owner() {
    return null;
  }
  isActive(): boolean {
    return this.active;
  }
  activeDuringSpawnPhase(): boolean {
    return true;
  }
  snapshot(): ExecRecord {
    return GodLaunchSnapshot.write({
      active: this.active,
      weapon: this.weapon,
      tile: this.tile,
    });
  }
  restoreSnapshot(s: GodLaunchState, r: SnapshotReader): void {
    this.active = s.active;
    this.weapon = s.weapon;
    this.tile = s.tile;
    this.game = r.game;
  }
}
const GodLaunchStateSchema = z.object({
  active: z.boolean(),
  weapon: z.enum(GOD_WEAPONS),
  tile: z.number().int().nonnegative(),
});
type GodLaunchState = z.infer<typeof GodLaunchStateSchema>;
export const GodLaunchSnapshot = execSnapshotType({
  name: "GodLaunch",
  version: 1,
  schema: GodLaunchStateSchema,
  cls: () => GodLaunchExecution,
});
