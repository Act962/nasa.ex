import "server-only";
import type { AccountProfile, DispatchResult } from "../../ports/channel-gateway";
import { InstagramGraphChannelGateway } from "./graph-channel-gateway";

/** Conta IG conectada pelo login do Facebook do ÓRBITA (spec 0061): token de página, host graph.facebook.com. */

const FACEBOOK_GRAPH_BASE_URL = process.env.META_GRAPH_BASE_URL ?? "https://graph.facebook.com/v21.0";

// Sem a página inscrita no app, a Meta não entrega os eventos do Instagram dela.
const PAGE_SUBSCRIBED_FIELDS = ["feed", "messages"];

export class MetaLoginInstagramChannelGateway extends InstagramGraphChannelGateway {
  constructor(
    igAccountId: string,
    private readonly pageId: string,
    pageAccessToken: string,
  ) {
    super(igAccountId, pageAccessToken, FACEBOOK_GRAPH_BASE_URL);
  }

  protected override messagesPath(): string {
    return `/${this.pageId}/messages`;
  }

  override async subscribeToEvents(): Promise<DispatchResult> {
    const result = await this.request<{ success?: boolean }>(
      `/${this.pageId}/subscribed_apps?subscribed_fields=${PAGE_SUBSCRIBED_FIELDS.join(",")}`,
      { method: "POST" },
    );
    if (result.ok) return { ok: true };

    // `messages` exige pages_messaging; sem ele, `feed` ainda instala o app na página.
    const fallback = await this.request<{ success?: boolean }>(
      `/${this.pageId}/subscribed_apps?subscribed_fields=feed`,
      { method: "POST" },
    );
    if (fallback.ok) return { ok: true };
    return { ok: false, error: result.error, authError: result.authError };
  }

  override async listSubscribedFields(): Promise<string[] | null> {
    const result = await this.request<{ data?: { id?: string; subscribed_fields?: string[] }[] }>(
      `/${this.pageId}/subscribed_apps`,
    );
    if (!result.ok) return null;
    const apps = result.data.data ?? [];
    const thisApp = apps.find((app) => app.id === process.env.META_APP_ID) ?? apps[0];
    return thisApp?.subscribed_fields ?? [];
  }

  override async fetchAccountProfile(): Promise<AccountProfile | null> {
    const result = await this.request<{ id?: string; username?: string; name?: string }>(
      `/${this.accountId}?fields=id,username,name`,
    );
    if (!result.ok || !result.data.id) return null;
    return {
      externalAccountId: String(result.data.id),
      handle: result.data.username,
      displayName: result.data.name ?? result.data.username,
    };
  }
}
