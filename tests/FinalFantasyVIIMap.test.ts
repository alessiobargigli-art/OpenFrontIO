import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { SpawnExecution } from "../src/core/execution/SpawnExecution";
import { TribeSpawner } from "../src/core/execution/TribeSpawner";
import { resolveTribeNameData } from "../src/core/execution/utils/TribeNames";
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  PlayerInfo,
  PlayerType,
  TerrainType,
  maps,
} from "../src/core/game/Game";
import { createGame } from "../src/core/game/GameImpl";
import { type GameMapLoader } from "../src/core/game/GameMapLoader";
import { createNationsForGame } from "../src/core/game/NationCreation";
import {
  loadTerrainMap,
  type MapManifest,
} from "../src/core/game/TerrainMapLoader";
import { UserSettings } from "../src/core/game/UserSettings";
import { PseudoRandom } from "../src/core/PseudoRandom";
import { GameConfigSchema } from "../src/core/Schemas";
import { TestConfig } from "./util/TestConfig";
import { testGameConfig } from "./util/Wire";

const directory = path.join(__dirname, "../resources/maps/finalfantasyvii");
const read = (name: string) => fs.readFile(path.join(directory, name));
const catalog = async (): Promise<{
  nation_names: Record<string, string>;
  enemy_groups: Record<string, string[]>;
}> =>
  JSON.parse(
    (
      await fs.readFile(
        path.join(__dirname, "../scripts/maps/ff7_enemies.json"),
      )
    ).toString(),
  );
// Only the I/O adapter is test-specific. Terrain decoding, scaling and the
// simulation run against the committed files using the production loader.
const loader: GameMapLoader = {
  getMapData: () => ({
    mapBin: () => read("map.bin"),
    map4xBin: () => read("map4x.bin"),
    map16xBin: () => read("map16x.bin"),
    manifest: async () =>
      JSON.parse((await read("manifest.json")).toString()) as MapManifest,
    webpPath: path.join(directory, "thumbnail.webp"),
    layerPng: async () => {
      throw new Error("Worker must not request decorative images");
    },
  }),
};

describe("FinalFantasyVII production map", () => {
  test("keeps Wutai and all three continents separated by navigable sea", async () => {
    const { gameMap: map, nations } = await loadTerrainMap(
      GameMapType.FinalFantasyVII,
      GameMapSize.Normal,
      loader,
      false,
      true,
    );
    for (const [x, y] of [
      [412, 806],
      [1142, 605],
      [847, 503],
      [1056, 864],
    ]) {
      expect(map.isWater(map.ref(x, y))).toBe(true);
      expect(map.isOcean(map.ref(x, y))).toBe(true);
    }
    const components = new Int32Array(map.width() * map.height());
    const queue = new Int32Array(components.length);
    const ids: number[] = [];
    let next = 0;
    for (const name of ["Godo", "Gi Nattak", "President Shinra", "Sephiroth"]) {
      const [x, y] = nations.find((n) => n.name === name)!.coordinates!;
      const start = map.ref(x, y);
      if (components[start] === 0) {
        const id = ++next;
        let readIndex = 0,
          end = 1;
        queue[0] = start;
        components[start] = id;
        while (readIndex < end) {
          const tile = queue[readIndex++];
          for (const neighbor of map.neighbors(tile)) {
            if (!components[neighbor] && map.isLand(neighbor)) {
              components[neighbor] = id;
              queue[end++] = neighbor;
            }
          }
        }
      }
      ids.push(components[start]);
    }
    expect(ids).toEqual([1, 2, 3, 4]);
  });

  test.each([GameMapSize.Normal, GameMapSize.Compact])(
    "loads actual terrain and valid named spawns at %s size",
    async (size) => {
      const terrain = await loadTerrainMap(
        GameMapType.FinalFantasyVII,
        size,
        loader,
        false,
        true,
      );
      const divisor = size === GameMapSize.Normal ? 1 : 2;
      expect(terrain.gameMap.width()).toBe(1920 / divisor);
      expect(terrain.gameMap.height()).toBe(1440 / divisor);
      expect(terrain.miniGameMap.width()).toBe(960 / divisor);
      expect(terrain.nations).toHaveLength(46);
      expect(new Set(terrain.nations.map((n) => n.name)).size).toBe(46);
      for (const nation of terrain.nations) {
        const [x, y] = nation.coordinates!;
        const tile = terrain.gameMap.ref(x, y);
        expect(terrain.gameMap.isValidCoord(x, y), nation.name).toBe(true);
        expect(terrain.gameMap.isLand(tile), nation.name).toBe(true);
        expect(terrain.gameMap.isImpassable(tile), nation.name).toBe(false);
      }
      expect(terrain.nations.map((n) => n.name)).toEqual(
        expect.arrayContaining([
          "President Shinra",
          "Rufus Shinra",
          "Reno",
          "Godo",
          "Sephiroth",
          "Gi Nattak",
          "Ultimate Weapon",
          "Jenova-SYNTHESIS",
          "Demons Gate",
        ]),
      );
      expect(terrain.layerImages).toBeUndefined();
      expect(terrain.layers?.map((l) => l.placement)).toEqual([
        "land",
        "water",
      ]);
      const ocean = terrain.gameMap.ref(
        Math.floor(1056 / divisor),
        Math.floor(864 / divisor),
      );
      expect(terrain.gameMap.isWater(ocean)).toBe(true);
      expect(terrain.gameMap.isOcean(ocean)).toBe(true);
      const types = new Set<TerrainType>();
      let countedLand = 0;
      terrain.gameMap.forEachTile((tile) => {
        types.add(terrain.gameMap.terrainType(tile));
        if (terrain.gameMap.isLand(tile)) countedLand++;
        if (terrain.gameMap.isImpassable(tile))
          throw new Error("Atlas must not have void walls");
      });
      expect(countedLand).toBe(terrain.gameMap.numLandTiles());
      expect(types.has(TerrainType.Mountain)).toBe(true);
      expect(types.has(TerrainType.Plains)).toBe(true);
    },
  );

  test.each([GameMapSize.Normal, GameMapSize.Compact])(
    "spawns players and advances a real game at %s size",
    async (size) => {
      const terrain = await loadTerrainMap(
        GameMapType.FinalFantasyVII,
        size,
        loader,
        false,
        true,
      );
      const regions = [
        "Reno",
        "Gi Nattak",
        "Godo",
        "Sephiroth",
        "Ultimate Weapon",
      ];
      const players = regions.map(
        (name, i) =>
          new PlayerInfo(name, PlayerType.Human, `client-${i}`, `player-${i}`),
      );
      const gameConfig = GameConfigSchema.parse({
        gameMap: GameMapType.FinalFantasyVII,
        gameMapSize: size,
        gameMode: GameMode.FFA,
        gameType: GameType.Private,
        difficulty: Difficulty.Medium,
        nations: "disabled",
        bots: 0,
        donateGold: false,
        donateTroops: false,
        infiniteGold: false,
        infiniteTroops: false,
        instantBuild: false,
        randomSpawn: false,
      });
      const config = new TestConfig(gameConfig, new UserSettings(), false);
      const game = createGame(
        players,
        [],
        terrain.gameMap,
        terrain.miniGameMap,
        config,
      );
      game.endSpawnPhase();
      for (let i = 0; i < players.length; i++) {
        const [x, y] = terrain.nations.find(
          (n) => n.name === regions[i],
        )!.coordinates!;
        game.addExecution(
          new SpawnExecution(
            "finalfantasyvii-smoke",
            players[i],
            game.ref(x, y),
          ),
        );
      }
      for (let i = 0; i < 12; i++) game.executeNextTick();
      for (let i = 0; i < players.length; i++) {
        const player = game.playerByClientID(`client-${i}`)!;
        const [x, y] = terrain.nations.find(
          (n) => n.name === regions[i],
        )!.coordinates!;
        expect(player.spawnTile()).toBe(game.ref(x, y));
        expect(player.numTilesOwned()).toBeGreaterThan(0);
        expect(game.owner(game.ref(x, y))).toBe(player);
      }
    },
  );

  test("binds every nation to its regional faction and registers the complete bot catalog", async () => {
    const factions = await catalog();
    const bots = Object.values(factions.enemy_groups).flat();
    const manifest = JSON.parse(
      (await read("manifest.json")).toString(),
    ) as MapManifest;
    const map = maps.find((m) => m.type === GameMapType.FinalFantasyVII)!;
    expect(manifest.nations.map((n) => n.name)).toEqual(
      Object.values(factions.nation_names),
    );
    expect(map.customTribes?.map((n) => n.name)).toEqual(bots);
    expect(map.themes).toEqual(["ff7"]);
    expect(bots).toHaveLength(509);
    expect(
      new Set([...bots, ...Object.values(factions.nation_names)]).size,
    ).toBe(555);
    expect(bots).toEqual(
      expect.arrayContaining([
        "Emerald Weapon",
        "Ruby Weapon",
        "Diamond Weapon",
        "Safer Sephiroth",
        "Hell House",
        "Whisper Bahamut",
        "Sephiroth Reborn",
        "Tonberry King",
      ]),
    );
    expect(factions.nation_names.Midgar).toBe("President Shinra");
    expect(factions.nation_names["Cosmo Canyon"]).toBe("Gi Nattak");
    expect(factions.nation_names["Northern Crater"]).toBe("Sephiroth");
    expect(resolveTribeNameData(GameMapType.FinalFantasyVII).names).toEqual(
      bots,
    );
  });

  test.each([GameMapSize.Normal, GameMapSize.Compact])(
    "spawns the maximum 400 bots with FFVII names at %s size",
    async (size) => {
      const factions = await catalog();
      const botNames = Object.values(factions.enemy_groups).flat();
      const terrain = await loadTerrainMap(
        GameMapType.FinalFantasyVII,
        size,
        loader,
        false,
        true,
      );
      const config = new TestConfig(
        testGameConfig({
          gameMap: GameMapType.FinalFantasyVII,
          gameMapSize: size,
          bots: 400,
          nations: "disabled",
        }),
        new UserSettings(),
        false,
      );
      const game = createGame(
        [],
        [],
        terrain.gameMap,
        terrain.miniGameMap,
        config,
      );
      game.endSpawnPhase();
      game.addExecution(
        ...new TribeSpawner(game, "finalfantasyvii-factions").spawnTribes(400),
      );
      game.executeNextTick();
      game.executeNextTick();
      const bots = game.allPlayers().filter((p) => p.type() === PlayerType.Bot);
      expect(bots).toHaveLength(400);
      expect(new Set(bots.map((p) => p.name())).size).toBe(400);
      for (const bot of bots) {
        expect(botNames).toContain(bot.name());
        expect(game.isLand(bot.spawnTile()!)).toBe(true);
      }
      // Re-run the same real simulation on fresh terrain, including placement
      // and identity, to catch unseeded naming/selection after pool exhaustion.
      const other = await loadTerrainMap(
        GameMapType.FinalFantasyVII,
        size,
        loader,
        false,
        true,
      );
      const twin = createGame([], [], other.gameMap, other.miniGameMap, config);
      twin.endSpawnPhase();
      twin.addExecution(
        ...new TribeSpawner(twin, "finalfantasyvii-factions").spawnTribes(400),
      );
      twin.executeNextTick();
      twin.executeNextTick();
      const identities = (g: typeof game) =>
        g
          .allPlayers()
          .filter((p) => p.type() === PlayerType.Bot)
          .map((p) => [p.name(), p.id(), p.spawnTile()]);
      expect(identities(twin)).toEqual(identities(game));
    },
  );

  test("uses FFVII factions even when the requested nation count is raised to 400", async () => {
    const terrain = await loadTerrainMap(
      GameMapType.FinalFantasyVII,
      GameMapSize.Normal,
      loader,
      false,
      true,
    );
    const factions = await catalog();
    const canonical = new Set([
      ...Object.values(factions.nation_names),
      ...Object.values(factions.enemy_groups).flat(),
    ]);
    const info = {
      gameID: "finalfantasyvii1",
      lobbyCreatedAt: 0,
      players: [],
      config: testGameConfig({
        gameMap: GameMapType.FinalFantasyVII,
        nations: 400,
      }),
    };
    const nations = createNationsForGame(
      info,
      terrain.nations,
      terrain.additionalNations,
      1,
      new PseudoRandom(42),
    );
    expect(nations).toHaveLength(400);
    expect(new Set(nations.map((n) => n.playerInfo.name)).size).toBe(400);
    for (const n of nations)
      expect(canonical.has(n.playerInfo.name)).toBe(true);
  });

  test("appears in the fictional picker but has zero public rotation weight", () => {
    const map = maps.find((m) => m.type === GameMapType.FinalFantasyVII)!;
    expect(map.categories).toContain("fictional");
    expect(map.translationKey).toBe("map.finalfantasyvii");
    expect(map.multiplayerFrequency).toBe(0);
    expect(map.ffaFrequency).toBe(-1);
    expect(map.teamFrequency).toBe(-1);
    expect(map.specialFrequency).toBe(-1);
  });
});
