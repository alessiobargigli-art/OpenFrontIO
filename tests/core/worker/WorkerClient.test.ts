import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkerClient } from "../../../src/core/worker/WorkerClient";
import type {
  PlayerActionsResultMessage,
  WorkerMessage,
} from "../../../src/core/worker/WorkerMessages";

const inlineWorker = vi.hoisted(() => ({
  postMessage: vi.fn(),
  addEventListener: vi.fn(),
}));

vi.mock("../../../src/core/worker/Worker.worker.ts?worker&inline", () => ({
  default: class {
    postMessage = inlineWorker.postMessage;
    addEventListener = inlineWorker.addEventListener;
  },
}));

describe("WorkerClient initialization", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("passes the owning page URL to the inline game worker", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      location: { href: "https://my-game.onrender.com/room/abcd" },
      BOOTSTRAP_CONFIG: { cdnBase: "" },
    });
    inlineWorker.postMessage.mockImplementation((message) => {
      const listener = inlineWorker.addEventListener.mock.calls[0][1];
      listener({ data: { type: "initialized", id: message.id } });
    });
    const gameStartInfo = {} as never;
    const client = new WorkerClient(gameStartInfo, undefined);
    await client.initialize();
    expect(inlineWorker.postMessage).toHaveBeenCalledWith({
      type: "init",
      id: expect.any(String),
      gameStartInfo,
      clientID: undefined,
      cdnBase: "",
      assetBaseUrl: "https://my-game.onrender.com/room/abcd",
      snapshot: undefined,
    });
    client.start(() => {});
  });
});

type MockWorker = {
  postMessage: (message: unknown) => void;
};

function createClient() {
  const worker: MockWorker = {
    postMessage: vi.fn(),
  };
  const client = new WorkerClient({} as never, undefined);
  const internalClient = client as unknown as {
    worker: MockWorker;
    isInitialized: boolean;
    messageHandlers: Map<string, unknown>;
    handleWorkerMessage: (event: MessageEvent<WorkerMessage>) => void;
  };
  internalClient.worker = worker;
  internalClient.isInitialized = true;
  return { client, worker, internalClient };
}

function actionsResult(): PlayerActionsResultMessage {
  return {
    type: "player_actions_result",
    id: "request-id",
    result: {
      canAttack: true,
      buildableUnits: [],
      canSendEmojiAllPlayers: false,
    },
  };
}

describe("WorkerClient playerInteraction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves and removes the handler when the worker responds", async () => {
    const { client, worker, internalClient } = createClient();
    const promise = client.playerInteraction("7");
    const request = vi.mocked(worker.postMessage).mock.calls[0][0] as {
      id: string;
    };

    internalClient.handleWorkerMessage({
      data: { ...actionsResult(), id: request.id },
    } as MessageEvent<WorkerMessage>);

    await expect(promise).resolves.toEqual({
      canAttack: true,
      buildableUnits: [],
      canSendEmojiAllPlayers: false,
    });
    expect(internalClient.messageHandlers.size).toBe(0);
  });

  it("rejects and removes the handler when the worker reports an error", async () => {
    const { client, worker, internalClient } = createClient();
    const promise = client.playerInteraction("7");
    const rejection = expect(promise).rejects.toThrow(
      "player with id 7 not found",
    );
    const request = vi.mocked(worker.postMessage).mock.calls[0][0] as {
      id: string;
    };

    internalClient.handleWorkerMessage({
      data: {
        type: "player_actions_error",
        id: request.id,
        error: "player with id 7 not found",
      },
    } as MessageEvent<WorkerMessage>);

    await rejection;
    expect(internalClient.messageHandlers.size).toBe(0);
  });

  it("rejects and removes the handler when the worker does not respond", async () => {
    const { client, internalClient } = createClient();
    const promise = client.playerInteraction("7");
    const rejection = expect(promise).rejects.toThrow(
      "player_actions request timed out",
    );

    await vi.advanceTimersByTimeAsync(5000);

    await rejection;
    expect(internalClient.messageHandlers.size).toBe(0);
  });

  it("cleans up only the request that times out when requests run concurrently", async () => {
    const { client, worker, internalClient } = createClient();
    const first = client.playerInteraction("7");
    const second = client.playerInteraction("8");
    const requests = vi
      .mocked(worker.postMessage)
      .mock.calls.map(([message]) => message as { id: string });
    const secondRejection = expect(second).rejects.toThrow(
      "player with id 8 not found",
    );

    internalClient.handleWorkerMessage({
      data: {
        type: "player_actions_error",
        id: requests[1].id,
        error: "player with id 8 not found",
      },
    } as MessageEvent<WorkerMessage>);

    await secondRejection;
    expect(internalClient.messageHandlers.size).toBe(1);

    const firstRejection = expect(first).rejects.toThrow(
      "player_actions request timed out",
    );
    await vi.advanceTimersByTimeAsync(5000);
    await firstRejection;
    expect(internalClient.messageHandlers.size).toBe(0);
  });
});
