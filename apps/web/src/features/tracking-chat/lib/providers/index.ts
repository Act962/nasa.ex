/**
 * Barrel da PORT do chat de atendimento.
 *
 * Importar `@/features/tracking-chat/lib/providers` é o jeito canônico de
 * obter o factory já com **todos os adapters registrados** — os imports
 * abaixo têm o side-effect de chamar `registerProvider(...)` em cada
 * adapter.
 *
 * Uso típico (Fase 6, ainda não wired):
 *
 *   import { createProvider } from "@/features/tracking-chat/lib/providers";
 *
 *   const provider = createProvider("meta-cloud", {
 *     accessToken, phoneNumberId, appSecret,
 *   });
 *   await provider.sendText({ kind: "text", to, body });
 *
 * Pra registrar um 3º provider amanhã, basta criar mais um arquivo em
 * `adapters/<id>/provider.ts` que chame `registerProvider("<id>", builder)`
 * e re-exportá-lo aqui.
 */

// PORT + canônico
export type {
  CanonicalInboundMessage,
  CanonicalInboundText,
  CanonicalInboundMedia,
  CanonicalInboundLocation,
  CanonicalInboundContact,
  CanonicalInboundReaction,
  CanonicalInboundInteractiveReply,
  CanonicalInboundUnsupported,
  CanonicalInboundInstance,
  CanonicalInboundSender,
  CanonicalInboundStatusUpdate,
  CanonicalMediaKind,
  NormalizedInbound,
  ProviderBuilder,
  ProviderConfig,
  ProviderId,
  ProviderWebhookHeaders,
  SendCanonicalContact,
  SendCanonicalInput,
  SendCanonicalLocation,
  SendCanonicalMedia,
  SendCanonicalText,
  SendResult,
  WhatsAppChatProvider,
} from "./types";

// Factory
export {
  createProvider,
  registerProvider,
  listRegisteredProviders,
  clearProviderRegistry,
  UnknownProviderError,
} from "./factory";

// Side-effect: registra os adapters. NÃO remover — sem estes imports o
// factory não conhece nenhum provider.
import "./adapters/uazapi/provider";
import "./adapters/meta-cloud/provider";

// Re-export das classes (útil pra testes manuais e para tipagem do
// `instanceof` em chamadas legadas).
export { UazapiProvider } from "./adapters/uazapi/provider";
export type { UazapiProviderConfig } from "./adapters/uazapi/provider";
export { OfficialProvider } from "./adapters/meta-cloud/provider";
export type { MetaCloudProviderConfig } from "./adapters/meta-cloud/provider";

// Credenciais Meta cifradas (Fase 4). Não re-exporta `decryptStored...`
// porque é puro server-only consumido nas procedures — pra evitar import
// acidental de client.
export {
  encryptMetaCredentialsInput,
  maskMetaCredentials,
  MetaCredentialsMissingError,
} from "./meta-credentials";
export type {
  MetaCredentialsInput,
  MetaCredentialsCipher,
  MetaCredentialsStored,
  MetaCredentialsMasked,
  MetaCredentialsPlain,
} from "./meta-credentials";

// Resolver outbound (Fase 6) — único caminho dos handlers `router/message/*`
// pra falar com um provider. Cacheado por `trackingId`.
export {
  resolveOutboundProvider,
  invalidateOutboundProvider,
  clearOutboundProviderCache,
} from "./resolve-outbound-provider";
export type { ResolvedOutboundProvider } from "./resolve-outbound-provider";

// Erros estruturados do caminho outbound.
export {
  OutboundProviderError,
  InstanceNotFoundError,
  MetaCredentialsIncompleteError,
  MetaFeatureUnsupportedError,
  ProviderSendInvalidResponseError,
} from "./outbound-errors";
