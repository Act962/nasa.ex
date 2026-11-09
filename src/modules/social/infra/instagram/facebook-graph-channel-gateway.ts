import "server-only";
import type { AccountProfile } from "../../ports/channel-gateway";
import { InstagramGraphChannelGateway } from "./graph-channel-gateway";

/** Conta IG acessada com token do Facebook (`EAA...`): mesmo contrato, host graph.facebook.com. */

const FACEBOOK_GRAPH_BASE_URL = process.env.META_GRAPH_BASE_URL ?? "https://graph.facebook.com/v21.0";

export class FacebookGraphInstagramChannelGateway extends InstagramGraphChannelGateway {
  constructor(igAccountId: string, accessToken: string) {
    super(igAccountId, accessToken, FACEBOOK_GRAPH_BASE_URL);
  }

  // Em graph.facebook.com o `/me` de um token desses não é a conta IG, e `user_id` não existe.
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
