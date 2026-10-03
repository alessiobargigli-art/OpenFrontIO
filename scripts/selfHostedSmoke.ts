// Run after building: node --import tsx scripts/selfHostedSmoke.ts
// Uses real HTTP and binary WebSockets against a production master + 2 workers.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import WebSocket from "ws";
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "../src/core/game/Game";
import { ClientMessage, ServerMessage } from "../src/core/Schemas";
import {
  createGameWireContext,
  decodeServerMessage,
  encodeClientMessage,
} from "../src/core/ZbinWire";

const commit = "selfhost-smoke";
const repoRoot = path.resolve(import.meta.dirname, "..");
const config = {
  SELF_HOSTED: "true",
  GAME_ENV: "prod",
  NUM_WORKERS: "2",
  INSTANCE_LETTER: "a",
  GIT_COMMIT: commit,
  RENDER_GIT_COMMIT: commit,
  DOMAIN: "localhost",
  LOBBY_COORDINATOR: "off",
};
const envFileMode = process.argv.includes("--env-file");
const envDir = envFileMode
  ? mkdtempSync(path.join(tmpdir(), "openfront-env-"))
  : undefined;
const childEnv: NodeJS.ProcessEnv = { ...process.env, ...config };
if (envDir) {
  // Only the .env file can supply these values: inherited test configuration
  // must not hide the import-order regression this mode checks.
  for (const key of Object.keys(config)) delete childEnv[key];
  childEnv.DOTENV_CONFIG_PATH = path.join(envDir, ".env");
  writeFileSync(
    path.join(envDir, ".env"),
    Object.entries(config)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
  );
}
const child = spawn(
  process.execPath,
  [
    "--import",
    path.join(repoRoot, "node_modules/tsx/dist/loader.mjs"),
    path.join(repoRoot, "src/server/Server.ts"),
  ],
  {
    cwd: repoRoot,
    detached: true,
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
child.stdout.on("data", (b) => {
  logs += b.toString();
});
child.stderr.on("data", (b) => {
  logs += b.toString();
});
const sockets: WebSocket[] = [];
async function until<T>(
  fn: () => T | Promise<T>,
  label: string,
  timeout = 15_000,
): Promise<NonNullable<T>> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = await fn();
    if (result) return result as NonNullable<T>;
    await delay(50);
  }
  throw new Error(`Timeout: ${label}`);
}
async function request(
  base: string,
  route: string,
  token?: string,
  body?: unknown,
) {
  return fetch(base + route, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(2000),
  });
}
async function peer(
  port: number,
  token: string,
  gameID: string,
  rejoinTurn?: number,
) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/`);
  sockets.push(ws);
  let ctx: ReturnType<typeof createGameWireContext> | undefined;
  const messages: ServerMessage[] = [];
  let error: unknown;
  ws.on("error", (e) => {
    error = e;
  });
  ws.on("message", (data: Buffer) => {
    try {
      const msg = decodeServerMessage(data, ctx);
      if (msg.type === "start")
        ctx = createGameWireContext(msg.gameStartInfo.players);
      messages.push(msg);
    } catch (e) {
      error = e;
    }
  });
  const send = (msg: ClientMessage) => ws.send(encodeClientMessage(msg, ctx));
  await until(() => {
    if (error) throw error;
    return ws.readyState === WebSocket.OPEN;
  }, "socket open");
  if (rejoinTurn === undefined) {
    send({
      type: "join",
      token,
      gameID,
      username: "SmokePlayer",
      clanTag: null,
      turnstileToken: null,
      gitCommit: commit,
      platform: "web",
    });
  } else {
    send({
      type: "rejoin",
      token,
      gameID,
      lastTurn: rejoinTurn,
      gitCommit: commit,
    });
  }
  return {
    ws,
    messages,
    send,
    wait: (test: (m: ServerMessage) => boolean) =>
      until(() => {
        if (error) throw error;
        return messages.find(test);
      }, "server message"),
  };
}

try {
  await until(async () => {
    if (child.exitCode !== null)
      throw new Error(`Server exited with code ${child.exitCode}`);
    try {
      return (await fetch("http://127.0.0.1:3000/api/health")).ok;
    } catch {
      return false;
    }
  }, "cluster health");
  const page = await (await request("http://127.0.0.1:3000", "/")).text();
  assert.match(page, /selfHosted:\s*true/);
  assert.doesNotMatch(
    page,
    /<script[^>]+src=["'][^"']*(?:crazygames|googletagmanager|cloudflareinsights|challenges\.cloudflare)/,
  );
  assert.match(page, /ForkLogo/);
  assert.equal(
    (await request("http://127.0.0.1:3000", "/selfhost/users/@me")).status,
    404,
  );
  for (const worker of [0, 1]) {
    const port = 3001 + worker;
    const base = `http://127.0.0.1:${port}`;
    assert.equal(
      (await request(base, "/api/create_game", "bad-token", {})).status,
      401,
    );
    const hostToken = randomUUID();
    const config = {
      gameMap: GameMapType.World,
      difficulty: Difficulty.Easy,
      gameType: GameType.Private,
      gameMode: GameMode.FFA,
      gameMapSize: GameMapSize.Normal,
      donateGold: false,
      donateTroops: false,
      nations: "disabled",
      bots: 0,
      infiniteGold: false,
      infiniteTroops: false,
      instantBuild: false,
      randomSpawn: false,
      startDelay: 0,
    };
    assert.equal(
      (
        await request(base, "/api/create_game", hostToken, {
          ...config,
          trusted: true,
        })
      ).status,
      400,
    );
    const created = await request(base, "/api/create_game", hostToken, config);
    assert.equal(created.status, 200, await created.clone().text());
    const game = await created.json();
    assert.equal(game.workerIndex, worker);
    const host = await peer(port, hostToken, game.gameID);
    const guestToken = randomUUID();
    const guest = await peer(port, guestToken, game.gameID);
    await host.wait(
      (m) => m.type === "lobby_info" && m.lobby.clients?.length === 2,
    );
    await guest.wait((m) => m.type === "lobby_info");
    // A guest must not inherit host authority just because both use UUIDs.
    guest.send({ type: "intent", intent: { type: "toggle_game_start_timer" } });
    await delay(600);
    assert(!host.messages.some((m) => m.type === "start"));
    host.send({
      type: "intent",
      intent: { type: "update_game_config", config: { trusted: true } },
    });
    await delay(150);
    const info = await (await request(base, `/api/game/${game.gameID}`)).json();
    assert(!info.gameConfig.trusted);
    host.send({ type: "intent", intent: { type: "toggle_game_start_timer" } });
    const started = await host.wait((m) => m.type === "start");
    assert(started.type === "start");
    const guestStart = await guest.wait((m) => m.type === "start");
    assert(guestStart.type === "start");
    assert.deepEqual(started.gameStartInfo, guestStart.gameStartInfo);
    assert.equal(started.gameStartInfo.players.length, 2);
    host.send({ type: "intent", intent: { type: "spawn", tile: 1000 } });
    guest.send({
      type: "intent",
      intent: { type: "attack", targetID: null, troops: 100 },
    });
    const hasCommands = (m: ServerMessage) =>
      m.type === "turn" &&
      m.turn.intents.some((i) => i.type === "spawn") &&
      m.turn.intents.some((i) => i.type === "attack");
    const turn = await host.wait(hasCommands);
    const guestTurn = await guest.wait(hasCommands);
    assert.deepEqual(turn, guestTurn);
    assert(turn.type === "turn");
    const lastTurn = turn.turn.turnNumber;
    guest.ws.close();
    await delay(500);
    const reconnect = await peer(port, guestToken, game.gameID, lastTurn);
    const resumed = await reconnect.wait((m) => m.type === "start");
    assert(resumed.type === "start");
    assert.equal(resumed.myClientID, guestStart.myClientID);
    assert.deepEqual(resumed.gameStartInfo, guestStart.gameStartInfo);
    await reconnect.wait((m) => m.type === "turn");
    for (const socket of [host.ws, guest.ws, reconnect.ws]) socket.terminate();
    console.log(
      `Worker ${worker}: guest lobby, host authorization, start, binary command relay, reconnect passed`,
    );
  }
  assert.doesNotMatch(
    logs,
    /External account API is disabled|Failed to start server/,
  );
  console.log(
    `Self-hosted production smoke passed (master + 2 workers, HTTP + WebSockets, ${envFileMode ? ".env file" : "process environment"})`,
  );
} catch (e) {
  console.error(logs.slice(-12_000));
  throw e;
} finally {
  for (const ws of sockets) ws.terminate();
  if (child.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      /* already stopped */
    }
  }
  if (child.exitCode === null && child.signalCode === null) {
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  }
  if (envDir) rmSync(envDir, { recursive: true, force: true });
}
