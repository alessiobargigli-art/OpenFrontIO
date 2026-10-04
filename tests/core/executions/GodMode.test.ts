import { Executor } from "../../../src/core/execution/ExecutionManager";
import { godMirvBusy } from "../../../src/core/execution/GodLaunchExecution";
import {
  GameType,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../../src/core/game/Game";
import { GOD_PLAYER_ID, godModeEnabled } from "../../../src/core/GodMode";
import { GameConfig } from "../../../src/core/Schemas";
import { snapshotGame } from "../../../src/core/snapshot/GameSnapshot";
import {
  decodeClientMessage,
  encodeClientMessage,
} from "../../../src/core/ZbinWire";
import { setup } from "../../util/Setup";
import { diffSnapshots, roundTrip } from "../../util/Snapshot";

const CAST = "cast0001";
async function make(config: Partial<GameConfig> = {}) {
  const game = await setup(
    "big_plains",
    { gameType: GameType.Private, ...config },
    [new PlayerInfo("Victim", PlayerType.Human, "human001", "human001")],
  );
  const victim = game.player("human001");
  victim.conquer(game.ref(50, 50));
  const executor = new Executor(game, "game0001", undefined);
  const launch = (
    weapon: UnitType.AtomBomb | UnitType.HydrogenBomb | UnitType.MIRV,
    clientID = CAST,
    tile = game.ref(50, 50),
  ) => {
    game.addExecution(
      executor.createExec({ type: "god_launch", clientID, weapon, tile }),
    );
  };
  const ticks = (n: number) => {
    for (let i = 0; i < n; i++) game.executeNextTick();
  };
  return { game, victim, launch, ticks };
}

describe("God spectator simulation", () => {
  test.each([UnitType.AtomBomb, UnitType.HydrogenBomb] as const)(
    "%s launches without territory, money or silo and causes real damage",
    async (weapon) => {
      const { game, victim, launch, ticks } = await make({
        disabledUnits: [weapon],
      });
      launch(weapon);
      ticks(4);
      const god = game.player(GOD_PLAYER_ID);
      expect(god.units(weapon)).toHaveLength(1);
      expect(god.gold()).toBe(0n);
      expect(god.numTilesOwned()).toBe(0);
      expect(god.team()).toBeNull();
      expect(game.players()).not.toContain(god);
      ticks(250);
      expect(victim.numTilesOwned()).toBe(0);
      expect(god.numTilesOwned()).toBe(0);
    },
  );

  test("missing setting enables private games; public and disabled modes reject launches", async () => {
    for (const config of [{ godMode: false }, { gameType: GameType.Public }]) {
      const { game, launch, ticks } = await make(config);
      expect(godModeEnabled(game.config().gameConfig())).toBe(false);
      launch(UnitType.AtomBomb);
      ticks(5);
      expect(game.hasPlayer(GOD_PLAYER_ID)).toBe(false);
    }
  });

  test("seated players cannot use God commands, including the owner", async () => {
    const { game, launch, ticks } = await make();
    launch(UnitType.AtomBomb, "human001");
    ticks(5);
    expect(game.hasPlayer(GOD_PLAYER_ID)).toBe(false);
  });

  test("different spectators automatically share God weapons and the MIRV lock", async () => {
    const { game, launch, ticks } = await make();
    launch(UnitType.AtomBomb, "watch001");
    launch(UnitType.HydrogenBomb, "watch002");
    launch(UnitType.MIRV, "watch001");
    launch(UnitType.MIRV, "watch002");
    ticks(4);
    const god = game.player(GOD_PLAYER_ID);
    expect(god.units(UnitType.AtomBomb)).toHaveLength(1);
    expect(god.units(UnitType.HydrogenBomb)).toHaveLength(1);
    expect(god.units(UnitType.MIRV)).toHaveLength(1);
  });

  test("two MIRVs in one turn share a lock through separation and all warheads", async () => {
    const { game, launch, ticks } = await make();
    launch(UnitType.MIRV);
    launch(UnitType.MIRV);
    ticks(4);
    const god = game.player(GOD_PLAYER_ID);
    expect(god.units(UnitType.MIRV)).toHaveLength(1);
    expect(game.mirvsLaunched()).toBe(0);
    expect(godMirvBusy(game)).toBe(true);
    let count = 0;
    while (god.units(UnitType.MIRV).some((u) => u.isActive()) && count++ < 2000)
      ticks(1);
    expect(count).toBeLessThan(2000);
    expect(godMirvBusy(game)).toBe(true);
    expect(god.units(UnitType.MIRVWarhead).some((u) => u.isActive())).toBe(
      true,
    );
    launch(UnitType.MIRV);
    ticks(3);
    expect(god.units(UnitType.MIRV).filter((u) => u.isActive())).toHaveLength(
      0,
    );
    count = 0;
    while (godMirvBusy(game) && count++ < 2000) ticks(1);
    expect(count).toBeLessThan(2000);
    launch(UnitType.MIRV);
    ticks(4);
    expect(god.units(UnitType.MIRV).filter((u) => u.isActive())).toHaveLength(
      1,
    );
  }, 20_000);

  test("a running God MIRV restores and continues deterministically", async () => {
    const { game, launch, ticks } = await make();
    launch(UnitType.MIRV);
    ticks(25);
    const { restored } = await roundTrip(game, "big_plains");
    expect(godMirvBusy(restored)).toBe(true);
    for (let i = 0; i < 50; i++) {
      game.executeNextTick();
      restored.executeNextTick();
    }
    expect(diffSnapshots(snapshotGame(game), snapshotGame(restored))).toEqual(
      [],
    );
  }, 20_000);

  test("out-of-map targets are ignored", async () => {
    const { game, launch, ticks } = await make();
    launch(UnitType.AtomBomb, CAST, game.width() * game.height());
    ticks(5);
    expect(game.hasPlayer(GOD_PLAYER_ID)).toBe(false);
  });

  test("God launches survive the real binary client wire", () => {
    const msg = {
      type: "intent" as const,
      intent: {
        type: "god_launch" as const,
        weapon: UnitType.MIRV as const,
        tile: 123,
      },
    };
    expect(
      decodeClientMessage(encodeClientMessage(msg, undefined), undefined),
    ).toEqual(msg);
  });
});
