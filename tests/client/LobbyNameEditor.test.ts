import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LobbyNameEditor } from "../../src/client/components/LobbyNameEditor";
import {
  LobbyRenameResultEvent,
  SendLobbyRenameEvent,
} from "../../src/client/Transport";
import { EventBus } from "../../src/core/EventBus";

vi.mock("../../src/client/Utils", () => ({
  translateText: (key: string) => key,
}));
vi.mock("../../src/client/LocalServer", () => ({ LocalServer: class {} }));

describe("lobby name editor", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    document.body.replaceChildren();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  async function setup() {
    const editor = new LobbyNameEditor();
    const bus = new EventBus();
    const sent = vi.fn();
    bus.on(SendLobbyRenameEvent, sent);
    editor.eventBus = bus;
    editor.client = {
      clientID: "c0000001",
      username: "OldName",
      clanTag: null,
    };
    document.body.append(editor);
    await editor.updateComplete;
    await editor.updateComplete;
    return { editor, bus, sent };
  }
  async function submit(editor: LobbyNameEditor, name: string) {
    const input = editor.querySelector("input")!;
    input.value = name;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    editor
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await editor.updateComplete;
  }

  it("prefills the current name, validates and submits with Enter/form", async () => {
    const { editor, sent } = await setup();
    expect(editor.querySelector("input")!.value).toBe("OldName");
    await submit(editor, "ab");
    expect(sent).not.toHaveBeenCalled();
    expect(editor.querySelector('[role="alert"]')).not.toBeNull();
    await submit(editor, "  Flower Child  ");
    expect(sent).toHaveBeenCalledWith(new SendLobbyRenameEvent("Flower Child"));
    expect(editor.querySelector("button")!.disabled).toBe(true);
  });

  it("uses the server-approved name and reports success", async () => {
    const { editor, bus } = await setup();
    await submit(editor, "Custom Name");
    bus.emit(new LobbyRenameResultEvent(true, "Censored Name"));
    await editor.updateComplete;
    expect(editor.querySelector("input")!.value).toBe("Censored Name");
    expect(editor.querySelector('[role="status"]')?.textContent).toContain(
      "lobby_name.saved",
    );
    expect(editor.querySelector("button")!.disabled).toBe(false);
  });

  it("resets the draft and pending request when entering another lobby", async () => {
    const { editor } = await setup();
    await submit(editor, "Unconfirmed Name");
    editor.lobbyID = "newlobby";
    editor.client = {
      clientID: "c0000002",
      username: "Next Name",
      clanTag: null,
    };
    await editor.updateComplete;
    await editor.updateComplete;
    expect(editor.querySelector("input")!.value).toBe("Next Name");
    expect(editor.querySelector("button")!.disabled).toBe(false);
  });

  it("reports rejection when the game starts during a save", async () => {
    const { editor, bus } = await setup();
    await submit(editor, "New Name");
    bus.emit(new LobbyRenameResultEvent(false, "OldName"));
    await editor.updateComplete;
    expect(editor.querySelector('[role="alert"]')?.textContent).toContain(
      "lobby_name.started",
    );
    expect(editor.querySelector('[role="status"]')).toBeNull();
  });

  it("unlocks retry when the connection produces no reply", async () => {
    const { editor } = await setup();
    await submit(editor, "New Name");
    vi.advanceTimersByTime(8000);
    await editor.updateComplete;
    expect(editor.querySelector("button")!.disabled).toBe(false);
    expect(editor.querySelector('[role="alert"]')?.textContent).toContain(
      "lobby_name.retry",
    );
  });
});
