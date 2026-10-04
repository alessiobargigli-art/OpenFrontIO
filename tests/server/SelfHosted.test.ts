import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameEnv } from "../../src/core/configuration/Config";
import { archive, readGameRecord } from "../../src/server/Archive";
import { checkinBody } from "../../src/server/ClusterCheckin";
import { fetchCustomTribes } from "../../src/server/CustomTribes";
import { verifyClientToken } from "../../src/server/jwt";
import { ServerEnv } from "../../src/server/ServerEnv";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("self-hosted guest boundary", () => {
  it("accepts an anonymous bearer secret in production without contacting the account API", async () => {
    vi.stubEnv("SELF_HOSTED", "true");
    vi.spyOn(ServerEnv, "env").mockReturnValue(GameEnv.Prod);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const token = randomUUID();
    expect(await verifyClientToken(token)).toEqual({
      type: "success",
      persistentId: token,
      claims: null,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("never promotes a foreign JWT or malformed token to an account", async () => {
    vi.stubEnv("SELF_HOSTED", "true");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const token of [
      "",
      "admin",
      "eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiJ9.",
    ]) {
      expect((await verifyClientToken(token)).type).toBe("error");
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the original production guest rejection when the mode is off", async () => {
    vi.stubEnv("SELF_HOSTED", "false");
    vi.spyOn(ServerEnv, "env").mockReturnValue(GameEnv.Prod);
    expect((await verifyClientToken(randomUUID())).type).toBe("error");
  });

  it("does not register, upload archives or fetch paid tribe names", async () => {
    vi.stubEnv("SELF_HOSTED", "true");
    vi.stubEnv("GAME_HOST", "should-not-register.example");
    vi.stubEnv("LOBBY_COORDINATOR", "api");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(checkinBody(1)).toBeNull();
    expect(ServerEnv.publicHost()).toBeUndefined();
    expect(ServerEnv.lobbyCoordinator()).toBe("off");
    expect(await fetchCustomTribes([])).toEqual([]);
    expect(await readGameRecord("a123456789")).toBeNull();
    await archive({} as Parameters<typeof archive>[0]);
    expect(fetch).not.toHaveBeenCalled();
    expect(() => ServerEnv.jwtIssuer()).toThrow("disabled");
  });

  it("uses the Render hostname and commit without manual account configuration", () => {
    vi.stubEnv("SELF_HOSTED", "true");
    vi.stubEnv("DOMAIN", "");
    vi.stubEnv("RENDER_EXTERNAL_HOSTNAME", "openfront-test.onrender.com");
    vi.stubEnv("RENDER_GIT_COMMIT", "a".repeat(40));
    expect(ServerEnv.domain()).toBe("openfront-test.onrender.com");
    expect(ServerEnv.gitCommit()).toBe("a".repeat(40));
    expect(ServerEnv.turnstileSiteKey()).toBe("");
  });
});
