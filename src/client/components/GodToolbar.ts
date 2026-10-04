import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { UnitType } from "../../core/game/Game";
import { GOD_PLAYER_ID, GodWeapon } from "../../core/GodMode";
import { atomBombIcon, hydrogenBombIcon, mirvIcon } from "../hud/HotbarIcons";
import { translateText } from "../Utils";
import { GameView } from "../view/GameView";

@customElement("god-toolbar")
export class GodToolbar extends LitElement {
  @property({ attribute: false }) game: GameView;
  @property({ attribute: false }) onLaunch?: (
    weapon: GodWeapon,
    tile: number,
  ) => void;
  @state() private selected: GodWeapon | null = null;
  private pendingMirvUntil = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  createRenderRoot() {
    return this;
  }
  connectedCallback() {
    super.connectedCallback();
    this.timer = setInterval(() => this.requestUpdate(), 250);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.timer);
  }
  private get mirvBusy(): boolean {
    return (
      Date.now() < this.pendingMirvUntil ||
      this.game
        ?.units(UnitType.MIRV, UnitType.MIRVWarhead)
        .some((u) => u.owner().id() === GOD_PLAYER_ID) === true
    );
  }
  consumeTarget(tile: number): boolean {
    if (!this.game || this.game.config().isReplay() || this.selected === null)
      return false;
    if (this.selected === UnitType.MIRV && this.mirvBusy) return true;
    this.onLaunch?.(this.selected, tile);
    if (this.selected === UnitType.MIRV)
      this.pendingMirvUntil = Date.now() + 2000;
    this.requestUpdate();
    return true;
  }
  render() {
    if (!this.game || this.game.config().isReplay()) return nothing;
    return html`<div
      class="fixed top-20 left-1/2 -translate-x-1/2 z-[10001] max-w-[95vw] rounded-xl border border-amber-300/40 bg-slate-950/95 p-3 text-white shadow-xl"
      @pointerdown=${(e: Event) => e.stopPropagation()}
      @pointerup=${(e: Event) => e.stopPropagation()}
      @mousedown=${(e: Event) => e.stopPropagation()}
      @mouseup=${(e: Event) => e.stopPropagation()}
      @touchstart=${(e: Event) => e.stopPropagation()}
      @touchend=${(e: Event) => e.stopPropagation()}
    >
      <div class="text-center text-xs font-bold text-amber-300 mb-2">
        ${translateText("god_mode.title")}
      </div>
      <div class="flex gap-2">
        ${(
          [
            [UnitType.AtomBomb, "god_mode.atom", atomBombIcon],
            [UnitType.HydrogenBomb, "god_mode.hydrogen", hydrogenBombIcon],
            [UnitType.MIRV, "god_mode.mirv", mirvIcon],
          ] as const
        ).map(
          ([weapon, label, icon]) =>
            html`<button
              type="button"
              data-weapon=${weapon}
              class="min-h-11 rounded-lg px-3 py-2 text-sm border ${this
                .selected === weapon
                ? "bg-amber-300 text-black border-amber-300"
                : "bg-white/10 border-white/20"} disabled:opacity-40"
              aria-pressed=${this.selected === weapon}
              ?disabled=${weapon === UnitType.MIRV && this.mirvBusy}
              @click=${() => {
                this.selected = this.selected === weapon ? null : weapon;
              }}
            >
              <img
                src=${icon}
                alt=""
                aria-hidden="true"
                class="mx-auto mb-1 h-7 w-7 object-contain"
              />
              ${translateText(label)}
            </button>`,
        )}
      </div>
      <div class="text-xs text-center text-white/70 mt-2" role="status">
        ${translateText(
          this.mirvBusy ? "god_mode.mirv_busy" : "god_mode.target_hint",
        )}
      </div>
    </div>`;
  }
}
