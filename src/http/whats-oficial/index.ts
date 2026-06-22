/**
 * HTTP cru da WhatsApp Business Cloud API (Meta).
 *
 * Este módulo expõe **apenas** funções `fetch` puras — nada de Prisma,
 * Pusher, ou regra de domínio. Espelha o padrão de `src/http/uazapi/`.
 *
 * ────────────────────────────────────────────────────────────────────────
 *  Arquitetura (ver `docs/whatsapp-oficial-overview.md`):
 *
 *    UI do chat  →  PORT WhatsAppChatProvider (Fase 2)
 *                    ├── UazapiProvider     → src/http/uazapi/*
 *                    └── OfficialProvider   → src/http/whats-oficial/*  ← AQUI
 *
 *  O esboço SOLID original (`abstract class WhastApp` + `Sender`) está
 *  validado conceitualmente, mas a **PORT real** vive em
 *  `src/features/tracking-chat/lib/providers/types.ts` (Fase 2), porque é
 *  regra de domínio — `src/http/` continua HTTP burro.
 * ────────────────────────────────────────────────────────────────────────
 */

export {
  graphFetch,
  graphFetchMultipart,
  graphFetchBinary,
} from "./client";

export { sendOfficialText } from "./send-text";
export { sendOfficialMedia } from "./send-media";
export { sendOfficialLocation } from "./send-location";
export { sendOfficialContact } from "./send-contact";

export { uploadOfficialMedia } from "./upload-media";
export {
  getOfficialMediaUrl,
  downloadOfficialMedia,
  downloadInboundMedia,
} from "./get-media";

export {
  whatsAppOfficialWebhookSchema,
  parseWhatsAppOfficialWebhook,
  unwrapCapturedFixture,
} from "./webhook-schema";
export type {
  WhatsAppOfficialWebhook,
  WhatsAppOfficialInboundMessage,
  WhatsAppOfficialStatus,
  WhatsAppOfficialMetadata,
  WhatsAppOfficialContact,
} from "./webhook-schema";

export {
  isMetaSignatureValid,
  verifyWebhookChallenge,
} from "./verify-signature";

// Embedded Signup (Fase 7) — HTTP clients de onboarding/provisioning.
export { exchangeCodeForToken } from "./exchange-code-for-token";
export { subscribeApp } from "./subscribe-app";
export { registerPhone } from "./register-phone";
export { getPhoneNumbers } from "./get-phone-numbers";
export { getWaba } from "./get-waba";

export type {
  MetaApiError,
  SendMessageResponse,
  MediaUploadResponse,
  MediaUrlResponse,
  E164DigitsOnly,
  MediaId,
  Wamid,
  OutboundMediaKind,
  SendTextInput,
  SendMediaInput,
  SendLocationInput,
  SendContactInput,
  UploadMediaInput,
  // Embedded Signup (Fase 7)
  OAuthExchangeResponse,
  SubscribeAppResponse,
  RegisterPhoneResponse,
  PhoneNumberMetadata,
  PhoneNumbersListResponse,
  CodeVerificationStatus,
  QualityRating,
  WabaInfo,
} from "./types";
