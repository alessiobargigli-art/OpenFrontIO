import { html, LitElement, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { EventBus } from "../../core/EventBus";
import { ClientInfo } from "../../core/Schemas";
import {
  MAX_USERNAME_LENGTH,
  validateUsername,
} from "../../core/validations/username";
import { LobbyRenameResultEvent, SendLobbyRenameEvent } from "../Transport";
import { translateText } from "../Utils";

@customElement("lobby-name-editor")
export class LobbyNameEditor extends LitElement {
  @property({ attribute: false }) eventBus: EventBus | null = null;
  @property({ attribute: false }) client: ClientInfo | undefined;
  @property({ type: String }) lobbyID = "";
  private dirty = false;
  @state() private draft = "";
  @state() private pending = false;
  @state() private error = "";
  @state() private saved = false;
  private subscribedBus: EventBus | null = null;
  private timeout: ReturnType<typeof setTimeout> | undefined;

  createRenderRoot() {
    return this;
  }

  protected updated(changed: PropertyValues) {
    if (this.subscribedBus !== this.eventBus) {
      this.subscribedBus?.off(LobbyRenameResultEvent, this.onResult);
      this.subscribedBus = this.eventBus;
      this.subscribedBus?.on(LobbyRenameResultEvent, this.onResult);
    }
    if (changed.has("lobbyID")) {
      clearTimeout(this.timeout);
      this.pending = false;
      this.dirty = false;
      this.error = "";
      this.saved = false;
    }
    if (
      (changed.has("client") || changed.has("lobbyID")) &&
      this.client &&
      !this.dirty &&
      !this.pending
    ) {
      this.draft = this.client.username;
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.requestUpdate();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.subscribedBus?.off(LobbyRenameResultEvent, this.onResult);
    this.subscribedBus = null;
    clearTimeout(this.timeout);
    this.pending = false;
  }

  private readonly onResult = (event: LobbyRenameResultEvent) => {
    if (!this.pending) return;
    clearTimeout(this.timeout);
    this.pending = false;
    this.saved = event.accepted;
    if (event.accepted) {
      this.draft = event.username;
      this.dirty = false;
    }
    this.error = event.accepted ? "" : translateText("lobby_name.started");
  };

  private submit(event: Event) {
    event.preventDefault();
    if (this.pending || !this.client || !this.eventBus) return;
    const username = this.draft.trim();
    const validation = validateUsername(username);
    this.saved = false;
    this.error = validation.error ?? "";
    if (!validation.isValid) return;
    this.pending = true;
    this.timeout = setTimeout(() => {
      this.pending = false;
      this.error = translateText("lobby_name.retry");
    }, 8000);
    this.eventBus.emit(new SendLobbyRenameEvent(username));
  }

  render() {
    if (!this.client) return html``;
    return html`
      <form
        @submit=${this.submit}
        class="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2"
      >
        <label class="block text-xs font-bold text-white/80">
          ${translateText("lobby_name.label")}
          <input
            type="text"
            name="lobby-name"
            maxlength=${MAX_USERNAME_LENGTH}
            .value=${this.draft}
            ?disabled=${this.pending}
            @input=${(event: Event) => {
              this.draft = (event.target as HTMLInputElement).value;
              this.dirty = true;
              this.error = "";
              this.saved = false;
            }}
            class="mt-2 w-full px-3 py-2 rounded-lg bg-black/30 border border-white/20 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <button
          type="submit"
          ?disabled=${this.pending || !this.eventBus}
          class="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-bold text-white disabled:opacity-50"
        >
          ${translateText(
            this.pending ? "lobby_name.saving" : "lobby_name.save",
          )}
        </button>
        <p class="text-xs text-white/50">${translateText("lobby_name.hint")}</p>
        ${this.error
          ? html`<p role="alert" class="text-xs text-red-300">${this.error}</p>`
          : ""}
        ${this.saved
          ? html`<p role="status" class="text-xs text-green-300">
              ${translateText("lobby_name.saved")}
            </p>`
          : ""}
      </form>
    `;
  }
}
