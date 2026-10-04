import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GodToolbar } from "../../src/client/components/GodToolbar";
import { GameView } from "../../src/client/view/GameView";
import { GOD_PLAYER_ID } from "../../src/core/GodMode";
import { UnitType } from "../../src/core/game/Game";

describe("God spectator controls", () => {
  let toolbar: GodToolbar;
  let ownerIDs: string[];
  let replay: boolean;
  const launch = vi.fn();

  beforeEach(async () => {
    vi.useFakeTimers();
    ownerIDs = [];
    replay = false;
    launch.mockReset();
    toolbar = new GodToolbar();
    toolbar.game = {
      config: () => ({ isReplay: () => replay }),
      units: () => ownerIDs.map((id) => ({ owner: () => ({ id: () => id }) })),
    } as unknown as GameView;
    toolbar.onLaunch = launch;
    document.body.append(toolbar);
    await toolbar.updateComplete;
  });
  afterEach(() => {
    toolbar.remove();
    vi.useRealTimers();
  });
  const button = (weapon: UnitType) =>
    toolbar.querySelector<HTMLButtonElement>(`[data-weapon="${weapon}"]`)!;

  it("selects a weapon, sends the clicked tile and cancels on a second selection", async () => {
    expect(toolbar.consumeTarget(123)).toBe(false);
    button(UnitType.AtomBomb).click();
    await toolbar.updateComplete;
    expect(toolbar.consumeTarget(123)).toBe(true);
    expect(launch).toHaveBeenCalledWith(UnitType.AtomBomb, 123);
    button(UnitType.AtomBomb).click();
    await toolbar.updateComplete;
    expect(toolbar.consumeTarget(124)).toBe(false);
    expect(launch).toHaveBeenCalledOnce();
  });

  it("blocks repeat MIRVs during delivery and while God warheads remain", async () => {
    button(UnitType.MIRV).click();
    await toolbar.updateComplete;
    toolbar.consumeTarget(100);
    toolbar.consumeTarget(101);
    await toolbar.updateComplete;
    expect(launch).toHaveBeenCalledOnce();
    expect(button(UnitType.MIRV).disabled).toBe(true);
    ownerIDs = [GOD_PLAYER_ID];
    vi.advanceTimersByTime(2500);
    await toolbar.updateComplete;
    expect(toolbar.consumeTarget(102)).toBe(true);
    expect(launch).toHaveBeenCalledOnce();
    ownerIDs = [];
    vi.advanceTimersByTime(250);
    await toolbar.updateComplete;
    expect(button(UnitType.MIRV).disabled).toBe(false);
    toolbar.consumeTarget(103);
    expect(launch).toHaveBeenCalledTimes(2);
  });

  it("ordinary MIRVs do not block God and atomics remain usable during a God MIRV", async () => {
    ownerIDs = ["human001"];
    toolbar.requestUpdate();
    await toolbar.updateComplete;
    expect(button(UnitType.MIRV).disabled).toBe(false);
    ownerIDs = [GOD_PLAYER_ID];
    button(UnitType.HydrogenBomb).click();
    await toolbar.updateComplete;
    expect(toolbar.consumeTarget(500)).toBe(true);
    expect(launch).toHaveBeenCalledWith(UnitType.HydrogenBomb, 500);
  });

  it("replay cannot send commands and removing controls releases the polling timer", async () => {
    button(UnitType.AtomBomb).click();
    await toolbar.updateComplete;
    replay = true;
    toolbar.requestUpdate();
    await toolbar.updateComplete;
    expect(toolbar.querySelector("button")).toBeNull();
    expect(toolbar.consumeTarget(123)).toBe(false);
    expect(launch).not.toHaveBeenCalled();
    toolbar.remove();
    expect(vi.getTimerCount()).toBe(0);
  });
});
