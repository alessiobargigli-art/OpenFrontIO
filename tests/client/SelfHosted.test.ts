import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getApiBase } from "../../src/client/ApiBase";
import { getPlayToken, userAuth } from "../../src/client/Auth";
import { ClientEnv } from "../../src/client/ClientEnv";
import {
  fetchCosmetics,
  getPlayerCosmeticsRefs,
} from "../../src/client/Cosmetics";
import {
  ensureServerList,
  startServerListPolling,
  stopServerListPolling,
} from "../../src/client/ServerList";

beforeEach(() => {
  window.BOOTSTRAP_CONFIG = {
    selfHosted: true,
    gameEnv: "prod",
    gitCommit: "a".repeat(40),
    turnstileSiteKey: "",
    jwtAudience: "test.onrender.com",
  };
  ClientEnv.reset();
  localStorage.clear();
});
afterEach(() => {
  stopServerListPolling();
  vi.unstubAllGlobals();
  delete window.BOOTSTRAP_CONFIG;
  ClientEnv.reset();
});

it("joins as a persistent guest without refresh, cosmetics or fleet API calls", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(await userAuth()).toBe(false);
  const token = await getPlayToken();
  expect(token).toMatch(/^[0-9a-f-]{36}$/);
  expect(await getPlayToken()).toBe(token);
  expect(await getPlayerCosmeticsRefs()).toEqual({});
  expect(await fetchCosmetics()).toEqual({ patterns: {}, flags: {} });
  startServerListPolling();
  expect(await ensureServerList()).toBe("fallback");
  expect(getApiBase()).toBe(window.location.origin + "/selfhost");
  expect(fetch).not.toHaveBeenCalled();
});
