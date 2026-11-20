import "server-only";
import type { DispatchResult } from "../../ports/channel-gateway";
import { FacebookGraphInstagramChannelGateway } from "./facebook-graph-channel-gateway";

/** Conta IG conectada pelo login do Facebook do ÓRBITA (spec 0061): token de página, host graph.facebook.com. */

// Sem a página inscrita no app, a Meta não entrega os eventos do Instagram dela.
const PAGE_SUBSCRIBED_FIELDS = ["feed", "messages"];

export class MetaLoginInstagramChannelGateway extends FacebookGraphInstagramChannelGateway {
  constructor(
    igAccountId: string,
    private readonly pageId: string,
    pageAccessToken: string,
  ) {
    super(igAccountId, pageAccessToken);
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
}
