import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { SpawnExecution } from "../src/core/execution/SpawnExecution";
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
import {
  loadTerrainMap,
  type MapManifest,
} from "../src/core/game/TerrainMapLoader";
import { UserSettings } from "../src/core/game/UserSettings";
import { GameConfigSchema } from "../src/core/Schemas";
import { TestConfig } from "./util/TestConfig";

const directory = path.join(__dirname, "../resources/maps/azeroth");
const read = (name: string) => fs.readFile(path.join(directory, name));
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

describe("Azeroth production map", () => {
  test.each([GameMapSize.Normal, GameMapSize.Compact])(
    "loads actual terrain and valid named spawns at %s size",
    async (size) => {
      const terrain = await loadTerrainMap(
        GameMapType.Azeroth,
        size,
        loader,
        false,
        true,
      );
      const divisor = size === GameMapSize.Normal ? 1 : 2;
      expect(terrain.gameMap.width()).toBe(1920 / divisor);
      expect(terrain.gameMap.height()).toBe(1536 / divisor);
      expect(terrain.miniGameMap.width()).toBe(960 / divisor);
      expect(terrain.nations).toHaveLength(123);
      expect(new Set(terrain.nations.map((n) => n.name)).size).toBe(123);
      for (const nation of terrain.nations) {
        const [x, y] = nation.coordinates!;
        const tile = terrain.gameMap.ref(x, y);
        expect(terrain.gameMap.isValidCoord(x, y), nation.name).toBe(true);
        expect(terrain.gameMap.isLand(tile), nation.name).toBe(true);
        expect(terrain.gameMap.isImpassable(tile), nation.name).toBe(false);
      }
      expect(terrain.nations.map((n) => n.name)).toEqual(
        expect.arrayContaining([
          "Silvermoon",
          "Zul'Aman",
          "Isle of Dorn",
          "K'aresh",
          "Harandar",
          "Voidstorm",
          "Nagrand (Outland)",
          "Nagrand (Draenor)",
          "Eredath",
          "Bastion",
          "Emerald Dream",
        ]),
      );
      expect(terrain.layerImages).toBeUndefined();
      expect(terrain.layers?.map((l) => l.placement)).toEqual([
        "land",
        "water",
      ]);
      const maelstrom = terrain.gameMap.ref(
        Math.floor(595 / divisor),
        Math.floor(641 / divisor),
      );
      expect(terrain.gameMap.isWater(maelstrom)).toBe(true);
      expect(terrain.gameMap.isOcean(maelstrom)).toBe(true);
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
        GameMapType.Azeroth,
        size,
        loader,
        false,
        true,
      );
      const regions = [
        "Orgrimmar",
        "Stormwind",
        "Nagrand (Outland)",
        "Bastion",
        "Harandar",
      ];
      const players = regions.map(
        (name, i) =>
          new PlayerInfo(name, PlayerType.Human, `client-${i}`, `player-${i}`),
      );
      const gameConfig = GameConfigSchema.parse({
        gameMap: GameMapType.Azeroth,
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
          new SpawnExecution("azeroth-smoke", players[i], game.ref(x, y)),
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

  test("appears in the fictional picker but has zero public rotation weight", () => {
    const map = maps.find((m) => m.type === GameMapType.Azeroth)!;
    expect(map.categories).toContain("fictional");
    expect(map.translationKey).toBe("map.azeroth");
    expect(map.multiplayerFrequency).toBe(0);
    expect(map.ffaFrequency).toBe(-1);
    expect(map.teamFrequency).toBe(-1);
    expect(map.specialFrequency).toBe(-1);
  });
});
