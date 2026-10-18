import { html, LitElement, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { assetUrl } from "../../core/AssetUrls";
import { EventBus } from "../../core/EventBus";
import { UnitType } from "../../core/game/Game";
import { ClientInfo } from "../../core/Schemas";
import { UNIT_SKIN_IDS, UnitSkin } from "../../core/UnitSkins";
import { SendUnitSkinEvent, UnitSkinResultEvent } from "../Transport";
import { savedUnitSkin, saveUnitSkin, unitSkinIcon } from "../UnitSkinAssets";
import { translateText } from "../Utils";

const PREVIEW_TYPES = [
  UnitType.City,
  UnitType.Port,
  UnitType.Factory,
  UnitType.DefensePost,
  UnitType.SAMLauncher,
  UnitType.MissileSilo,
];

@customElement("unit-skin-picker")
export class UnitSkinPicker extends LitElement {
  @property({ attribute: false }) eventBus: EventBus | null = null;
  @property({ attribute: false }) client: ClientInfo | undefined;
  @property({ type: String }) lobbyID = "";
  @property({ type: Boolean }) localOnly = false;
  @state() private selected: UnitSkin = savedUnitSkin();
  @state() private pending = false;
  @state() private status = "";
  @state() private error = false;
  private bus: EventBus | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  createRenderRoot() {
    return this;
  }
  connectedCallback() {
    super.connectedCallback();
    this.requestUpdate();
  }
  protected updated(changed: PropertyValues) {
    if (this.bus !== this.eventBus) {
      this.bus?.off(UnitSkinResultEvent, this.onResult);
      this.bus = this.eventBus;
      this.bus?.on(UnitSkinResultEvent, this.onResult);
    }
    if (changed.has("lobbyID")) {
      clearTimeout(this.timer);
      this.pending = false;
      this.status = "";
    }
    if (
      !this.pending &&
      this.client &&
      (changed.has("client") || changed.has("lobbyID"))
    ) {
      this.selected = this.client.unitSkin ?? "flower-power";
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.bus?.off(UnitSkinResultEvent, this.onResult);
    this.bus = null;
    clearTimeout(this.timer);
    this.pending = false;
  }
  private readonly onResult = (event: UnitSkinResultEvent) => {
    if (!this.pending) return;
    clearTimeout(this.timer);
    this.pending = false;
    this.selected = event.skin;
    this.error = !event.accepted;
    this.status = event.accepted ? "unit_skin.saved" : "unit_skin.unavailable";
  };
  private select(skin: UnitSkin) {
    if (this.pending) return;
    if (this.localOnly) {
      this.selected = skin;
      saveUnitSkin(skin);
      this.error = false;
      this.status = "unit_skin.saved";
      return;
    }
    if (!this.client || !this.eventBus) return;
    this.pending = true;
    this.status = "unit_skin.saving";
    this.error = false;
    this.timer = setTimeout(() => {
      this.pending = false;
      this.error = true;
      this.status = "unit_skin.retry";
    }, 8000);
    this.eventBus.emit(new SendUnitSkinEvent(skin));
  }
  render() {
    if (!this.localOnly && !this.client) return html``;
    return html`<section
      class="my-4 rounded-xl border border-white/10 bg-white/5 p-4 space-y-3"
    >
      <h3 class="text-sm font-bold text-white">
        ${translateText("unit_skin.title")}
      </h3>
      <p class="text-xs text-white/60">${translateText("unit_skin.hint")}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        ${UNIT_SKIN_IDS.map(
          (skin) =>
            html`<button
              type="button"
              data-unit-skin=${skin}
              aria-pressed=${this.selected === skin ? "true" : "false"}
              ?disabled=${this.pending || (!this.localOnly && !this.eventBus)}
              @click=${() => this.select(skin)}
              class="rounded-xl border-2 p-3 text-left text-white transition disabled:opacity-50 ${this
                .selected === skin
                ? "border-sky-400 bg-sky-500/15"
                : "border-white/10 hover:border-white/40 bg-black/20"}"
            >
              <span class="font-bold text-sm"
                >${translateText(
                  skin === "warcraft"
                    ? "unit_skin.warcraft"
                    : "unit_skin.flower_power",
                )}</span
              >
              <div
                class="grid grid-cols-6 gap-1 mt-3"
                aria-label=${translateText("unit_skin.preview")}
              >
                ${PREVIEW_TYPES.map(
                  (type) =>
                    html`<img
                      src=${assetUrl(unitSkinIcon(type, skin)!)}
                      alt=""
                      class="w-full aspect-square object-contain"
                    />`,
                )}
              </div>
            </button>`,
        )}
      </div>
      ${this.status
        ? html`<p
            role=${this.error ? "alert" : "status"}
            class="text-xs ${this.error ? "text-red-300" : "text-white/80"}"
          >
            ${translateText(this.status)}
          </p>`
        : ""}
    </section>`;
  }
}
