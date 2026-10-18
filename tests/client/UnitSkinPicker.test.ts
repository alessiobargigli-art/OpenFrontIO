import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UnitSkinPicker } from "../../src/client/components/UnitSkinPicker";
import {
  SendUnitSkinEvent,
  UnitSkinResultEvent,
} from "../../src/client/Transport";
import { savedUnitSkin } from "../../src/client/UnitSkinAssets";
import { EventBus } from "../../src/core/EventBus";
vi.mock("../../src/client/Utils", () => ({
  translateText: (key: string) => key,
}));
vi.mock("../../src/client/LocalServer", () => ({ LocalServer: class {} }));

describe("unit skin picker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    document.body.replaceChildren();
    vi.clearAllTimers();
    vi.useRealTimers();
    localStorage.clear();
  });
  async function setup(localOnly = false) {
    const picker = new UnitSkinPicker(),
      bus = new EventBus(),
      sent = vi.fn();
    bus.on(SendUnitSkinEvent, sent);
    picker.eventBus = bus;
    picker.localOnly = localOnly;
    if (!localOnly)
      picker.client = {
        clientID: "player01",
        username: "Alice",
        clanTag: null,
      };
    document.body.append(picker);
    await picker.updateComplete;
    await picker.updateComplete;
    return { picker, bus, sent };
  }
  it("shows both previews and applies the server-confirmed selection", async () => {
    const { picker, bus, sent } = await setup();
    expect(picker.querySelectorAll("img")).toHaveLength(12);
    (
      picker.querySelector('[data-unit-skin="warcraft"]') as HTMLButtonElement
    ).click();
    expect(sent).toHaveBeenCalledWith(new SendUnitSkinEvent("warcraft"));
    await picker.updateComplete;
    expect((picker.querySelector("button") as HTMLButtonElement).disabled).toBe(
      true,
    );
    bus.emit(new UnitSkinResultEvent(true, "warcraft"));
    await picker.updateComplete;
    expect(
      picker
        .querySelector('[data-unit-skin="warcraft"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("saves local singleplayer choices without requiring a websocket", async () => {
    const { picker, sent } = await setup(true);
    (
      picker.querySelector('[data-unit-skin="warcraft"]') as HTMLButtonElement
    ).click();
    expect(savedUnitSkin()).toBe("warcraft");
    expect(sent).not.toHaveBeenCalled();
  });
  it("displays a start-race rejection without changing the active pack", async () => {
    const { picker, bus } = await setup();
    (
      picker.querySelector('[data-unit-skin="warcraft"]') as HTMLButtonElement
    ).click();
    bus.emit(new UnitSkinResultEvent(false, "flower-power"));
    await picker.updateComplete;
    expect(picker.querySelector('[role="alert"]')?.textContent).toContain(
      "unit_skin.unavailable",
    );
    expect(
      picker
        .querySelector('[data-unit-skin="flower-power"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("allows retry after connection failure and resets on another lobby", async () => {
    const { picker } = await setup();
    (
      picker.querySelector('[data-unit-skin="warcraft"]') as HTMLButtonElement
    ).click();
    vi.advanceTimersByTime(8000);
    await picker.updateComplete;
    expect(picker.querySelector('[role="alert"]')?.textContent).toContain(
      "unit_skin.retry",
    );
    picker.lobbyID = "newlobby";
    picker.client = {
      clientID: "player02",
      username: "Bob",
      clanTag: null,
      unitSkin: "warcraft",
    };
    await picker.updateComplete;
    await picker.updateComplete;
    expect(picker.querySelector('[role="alert"]')).toBeNull();
    expect(
      picker
        .querySelector('[data-unit-skin="warcraft"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
  });
});
