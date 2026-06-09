# WhatsApp Oficial (Meta Cloud API) — Visão Geral

> Documento vivo da integração com a **API Oficial do WhatsApp Business (Meta Cloud API)** no NASA. Última revisão: 2026-06-09 (Fase 6 em PR — outbound via factory por-tracking; Uazapi e Meta coexistem; envio canônico unificado).
>
> **Regra de manutenção (CLAUDE.md item 13):** sempre que alterar qualquer coisa em `src/http/whats-oficial/`, `src/features/tracking-chat/lib/providers/`, o webhook oficial (`src/app/api/chat/webhook/official/`), ou modelos Prisma relacionados ao provider de WhatsApp, **atualize este arquivo na mesma sessão** — tabelas, roadmap/status, decisões e changelog sincronizados com o código.

---

## 1. Objetivo

A NASA já tem um chat de atendimento maduro construído sobre a **Uazapi** (API não-oficial do WhatsApp). Esta feature **não substitui** a Uazapi: adiciona a **Meta Cloud API** como **mais uma opção de provider**, e o **cliente escolhe** qual usar por tracking. Os dois coexistem; a mesma UI/fluxo de chat atende ambos.

A arquitetura é deliberadamente aberta a **N providers**: amanhã podemos plugar uma terceira API (oficial ou não) registrando um novo adapter, sem tocar na UI nem no resto do domínio. Padrão: **Strategy + DIP** (Ports & Adapters) — espelha o que já existe em `src/features/astro-bot/lib/` (`WhatsappBotChannel` + `UazapiBotChannel`).

---

## 2. Estado Atual

| Item | Status |
| --- | --- |
| Fase em andamento | **Fase 6 em PR ✅** — outbound resolvendo provider via factory por-tracking; Uazapi e Meta coexistem |
| Provider em produção | **Uazapi continua default** (zero regressão); trackings com `provider=META_CLOUD` enviam via Meta Cloud API após gravar credenciais |
| Meta Cloud API | Clients HTTP + PORT/adapters + pipeline canônica + schema/UI cifrados + webhook oficial + **outbound via factory por-tracking + gates Meta unsupported (edit/delete/buttons) + cache outbound de provider TTL 30s**. Roadmap completo |
| App Meta configurada | Sim (sandbox, número de testes) |
| Webhook real recebendo | Configurado em `n8n.nasaex.com/webhook/whats` (capturas em `jsons/webhooks/`) |
| Branch de integração | **`feature/whatsapp-oficial-integration`** (alvo de TODOS os PRs de fase — ver §2.1) |

### 2.1 Estratégia de branch de integração

Para mitigar o risco de regressão no chat (especialmente nas Fases 3 e 6, que refatoram código de produção quente), **todas as fases vivem em uma branch de integração de longa duração** antes de chegar em `main`:

```
main
 └─ feature/whatsapp-oficial-integration  (long-lived; tudo do feature passa por aqui)
     ├─ feature/tracking-chat-whatsapp-oficial-clients-meta-20260608  (Fase 1+2 — PR #297 mergeado)
     ├─ feature/tracking-chat-whatsapp-oficial-pipeline-canonical-20260608  (Fase 3 — PR #298 mergeado)
     ├─ feature/tracking-chat-whatsapp-oficial-schema-20260608      (Fase 4 — PR #300 mergeado)
     ├─ feature/tracking-chat-whatsapp-oficial-webhook-20260609     (Fase 5 — mergeado)
     └─ feature/tracking-chat-whatsapp-oficial-outbound-wiring-20260609 (Fase 6 — aberto)
```

**Regras (formalizadas no CLAUDE.md item 14):**

1. **PR de fase → integração.** Cada fase abre PR contra `feature/whatsapp-oficial-integration`, NUNCA contra `main`. Quando o `/ship` opera, retargetar com `gh pr edit <num> --base feature/whatsapp-oficial-integration` se necessário.
2. **Branch de fase nasce da integração.** `git fetch origin && git checkout -b feature/<app>-<desc>-<YYYYMMDD> origin/feature/whatsapp-oficial-integration` — assim a Fase 3 já enxerga a Fase 2 sem rebase manual.
3. **Cada PR de fase é mergeado por squash** na integração quando o critério de pronto da fase estiver verde. A branch de fase é deletada após o merge.
4. **Testes de integração** rodam contra `feature/whatsapp-oficial-integration` (e contra cada branch de fase enquanto ela está aberta). Bug encontrado na integração = nova PR contra a integração, não hotfix em fase já mergeada.
5. **PR final** `feature/whatsapp-oficial-integration` → `main` é aberto **só quando todas as 6 fases estão dentro** e o smoke test full (envio + recebimento em ambos providers) está verde. Esse PR é o release.

**Por que branch longa em vez de fases mergeadas direto em main:**

- Cada fase é entregável mas só faz sentido **junto** — Fase 3 sem Fase 5 deixa o caminho canônico aberto sem usar; Fase 4 sem Fase 6 grava schema que ninguém lê. Manter tudo em uma branch isola o "release" do estado intermediário.
- Permite rollback de granularidade fina: `git revert` de um commit de fase específica dentro da integração sem afetar as demais.
- Reduz pressão de manter `main` 100% verde durante o refator de 1298 linhas da Fase 3 — testes podem quebrar dentro da integração sem bloquear deploy de outras features.
- Quando o release for pra prod, **um único merge** entra em `main` (squash do PR final ou merge commit nomeado), facilitando bisect.

---

## 3. Arquitetura (alvo, ao fim do roadmap)

```
┌────────────────────────────────────────────────────────────────┐
│  UI do chat de atendimento (src/features/tracking-chat/...)    │
│  — depende SÓ da PORT, nunca de Uazapi/Meta direto             │
└──────────────────────┬─────────────────────────────────────────┘
                       │  resolveChatProvider(trackingId)
                       ▼
┌────────────────────────────────────────────────────────────────┐
│  PORT: WhatsAppChatProvider  (src/features/tracking-chat/      │
│        lib/providers/types.ts)                                  │
│  — sendText/sendMedia/sendLocation/sendContact                  │
│  — downloadInboundMedia / getConnectionState                    │
│  — normalize<X>Webhook → CanonicalInboundMessage                │
└─────────┬──────────────────────────────┬───────────────────────┘
          │                              │
   ┌──────▼──────────┐           ┌───────▼───────────┐
   │ UazapiProvider  │           │ OfficialProvider  │   (N+...)
   └──────┬──────────┘           └───────┬───────────┘
          │                              │
   ┌──────▼──────────┐           ┌───────▼──────────────────┐
   │ src/http/uazapi/│           │ src/http/whats-oficial/  │
   │  (HTTP cru)     │           │  (HTTP cru — ESTA FASE)  │
   └─────────────────┘           └──────────────────────────┘
```

Camadas:

1. **Clients HTTP crus** (`src/http/<provider>/`) — só `fetch`, sem domínio. Cada provider tem o seu.
2. **PORT + adapters** (`src/features/tracking-chat/lib/providers/`) — interface + classes que envolvem os clients e normalizam payloads para o shape canônico.
3. **Pipeline canônico** (`src/features/tracking-chat/lib/inbound/persist-canonical-inbound.ts`) — único caminho de persistência inbound, alimentado pelos normalizadores. Termina chamando `firePostInboundAutomations` existente. (Fase 3+)
4. **Webhooks** — um endpoint por provider (`/api/chat/webhook?trackingId=...` Uazapi vs `/api/chat/webhook/official` Meta), ambos convergindo no pipeline canônico. Uazapi roteia por querystring; Meta (endpoint compartilhado por todas as instâncias `META_CLOUD`) roteia por `phone_number_id` extraído do envelope + lookup cacheado (`getCachedTrackingByMetaPhoneNumberId`). Fase 5 ✅.
5. **Schema** — `WhatsAppInstance.provider` (enum `WhatsAppProvider`, default `UAZAPI`) + 5 colunas `meta*` cifradas com `@/lib/crypto` + `AI_SECRETS_KEY` (Fase 4 ✅). Forma 1:1 com a `WhatsAppInstance` existente, sem JOIN novo.

---

## 4. Mapa de Arquivos

### 4.1 HTTP cru — Meta Cloud API (Fase 1, esta sessão)

| Arquivo | Função |
| --- | --- |
| [client.ts](../src/http/whats-oficial/client.ts) | `graphFetch<T>` + `graphFetchMultipart<T>`. Base `graph.facebook.com/v23.0`, header `Authorization: Bearer`, erro Meta `{ error: { message, code, fbtrace_id } }`. |
| [send-text.ts](../src/http/whats-oficial/send-text.ts) | `sendOfficialText(accessToken, phoneNumberId, { to, body, previewUrl?, replyToWamid? })` |
| [send-media.ts](../src/http/whats-oficial/send-media.ts) | `sendOfficialMedia(...)` cobrindo image/audio/document/sticker/video — audio/sticker sem caption, document com filename |
| [send-location.ts](../src/http/whats-oficial/send-location.ts) | `sendOfficialLocation(...)` |
| [send-contact.ts](../src/http/whats-oficial/send-contact.ts) | `sendOfficialContact(...)` (mínimo nesta fase) |
| [upload-media.ts](../src/http/whats-oficial/upload-media.ts) | `uploadOfficialMedia(...)` via multipart → `{ id }` |
| [get-media.ts](../src/http/whats-oficial/get-media.ts) | `getOfficialMediaUrl`, `downloadOfficialMedia`, `downloadInboundMedia` |
| [webhook-schema.ts](../src/http/whats-oficial/webhook-schema.ts) | Schemas Zod do envelope Meta + `unwrapCapturedFixture` (lê formato n8n dos JSONs capturados) |
| [verify-signature.ts](../src/http/whats-oficial/verify-signature.ts) | `isMetaSignatureValid(rawBody, header, appSecret)` (HMAC-SHA256 + `timingSafeEqual`, fail-closed) + `verifyWebhookChallenge` |
| [types.ts](../src/http/whats-oficial/types.ts) | Response types + erro Meta + `z.infer` do webhook |
| [index.ts](../src/http/whats-oficial/index.ts) | Barrel re-exports |
| [playground/send-test.ts](../src/http/whats-oficial/playground/send-test.ts) | Script `tsx` manual para teste no sandbox |
| `jsons/webhooks/*.json` | Capturas reais de webhook (text, image, audio, document, sticker, message-with-image, message-with-docs) |
| `jsons/outputs/send-message.json` | Resposta real de envio (`{ messages: [{ id: "wamid..." }] }`) |

### 4.2 PORT + adapters (Fase 2 + expansão Fase 3)

| Arquivo | Função |
| --- | --- |
| [providers/types.ts](../src/features/tracking-chat/lib/providers/types.ts) | PORT `WhatsAppChatProvider` + `CanonicalInboundMessage` (union por `type`) + `SendCanonicalInput` + `SendResult` + `ProviderId` (string extensível). **Fase 3** adicionou `CanonicalInboundRevoke`, `editedExternalMessageId` em `InboundBase`, e `ownerExternalId` em `CanonicalInboundInstance` |
| [providers/factory.ts](../src/features/tracking-chat/lib/providers/factory.ts) | `registerProvider`/`createProvider`/`listRegisteredProviders` + `UnknownProviderError`. Registry `Map<ProviderId, ProviderBuilder>` — **aberto a N providers** |
| [providers/adapters/uazapi/provider.ts](../src/features/tracking-chat/lib/providers/adapters/uazapi/provider.ts) | `UazapiProvider implements WhatsAppChatProvider`. Mapeia send canônico↔Uazapi (`MediaType`). **Fase 3** expandiu `normalizeInbound` pra cobrir todos os tipos do route antigo: text/extended/conversation, image/video/audio/document/sticker, location/contact (com parse de vcard FN+TEL waid=), interactive (template button/buttons/list/interactive response), protocol-revoke, `quoted`/`edited`/`owner`. Auto-registra como `"uazapi"` |
| [providers/adapters/meta-cloud/provider.ts](../src/features/tracking-chat/lib/providers/adapters/meta-cloud/provider.ts) | `OfficialProvider implements WhatsAppChatProvider`. Mapeia send canônico↔Meta, normaliza envelope completo (`entry[].changes[].value.{messages,statuses}`) incluindo mídia, reaction, button/interactive. `verifyWebhook` delega a `isMetaSignatureValid`. Auto-registra como `"meta-cloud"` |
| [providers/index.ts](../src/features/tracking-chat/lib/providers/index.ts) | Barrel: re-exports + **side-effect imports** dos dois adapters (registro automático) |

### 4.3 Pipeline canônica inbound (Fase 3, implementada)

| Arquivo | Função |
| --- | --- |
| [inbound/persist-canonical-inbound.ts](../src/features/tracking-chat/lib/inbound/persist-canonical-inbound.ts) | **`persistCanonicalInbound(canonical, ctx)`** — caminho único de persistência inbound, provider-agnostic. Handles `revoke`, lead lookup/create (com strategies `fetchProfilePicture` + `ctwaSources`), conversation, quoted/edited lookups, per-type message upsert (`text`/`media`/`location`/`contact`/`interactive_reply`), agent IA dispatch (`dispatchMessageIncoming`), e `firePostInboundAutomations`. `reaction`/`unsupported` são skip silencioso. |
| [inbound/uazapi-strategies.ts](../src/features/tracking-chat/lib/inbound/uazapi-strategies.ts) | Strategies Uazapi-specific consumidas pelo pipeline: `buildUazapiFetchProfilePicture(token)` (via `/chat/details` + S3) e `buildUazapiDownloadInboundMedia(token)` (via `/message/download` + S3 com `generate_mp3` em áudio, fallback de extensão por kind). |

#### Extensões nos tipos canônicos (Fase 3)

`CanonicalInboundMessage` ganhou:
- `editedExternalMessageId?` em `InboundBase` — preenchido quando o webhook indica edição (Uazapi: `json.message.edited`); pipeline localiza o `Message` original e atualiza in-place via `messageId` original como upsert key.
- `ownerExternalId?` em `CanonicalInboundInstance` — captura `json.owner` da Uazapi (ex.: `5586...@s.whatsapp.net`); pipeline usa como `senderId` quando `fromMe=true`. Meta não ecoa fromMe via webhook, então não usa.
- Novo `CanonicalInboundRevoke { type: "revoke"; targetExternalMessageId }` — modela "mensagem apagada para todos". O adapter Uazapi normaliza `ProtocolMessage` com `content.type` revoke (0/"REVOKE"/`revokedMessageKey`) pra esse shape; pipeline marca a `Message` alvo como `MessageStatus.DELETED` + limpa body/mídia + dispara `pusher message:updated`.

#### Refator no webhook Uazapi

`src/app/api/chat/webhook/route.ts` caiu de **1298 → 490 linhas** (~62% de redução). O branch `messages` agora só:

1. Parse `messagesEventSchema`.
2. Lookup tracking via `getCachedTrackingContext`.
3. Intercept do Astro Bot (texto puro, `messageType==="TextMessage"`).
4. `createProvider("uazapi", { token, baseUrl })` + `provider.normalizeInbound(json)`.
5. Loop `persistCanonicalInbound(canonical, { trackingId, providerId: "uazapi", fetchProfilePicture, downloadInboundMedia, ctwaSources: [json.message, json], channel: "WHATSAPP" })`.
6. Mapeia falhas estruturais (`tracking_not_found`, `lead_creation_failed`) pra 400 — paridade com o "Status context not found" do route antigo.

Branches `connection`/`calls`/`labels`/`chat_labels` ficaram intactas (eventos Uazapi-specific sem equivalente Meta).

### 4.4 Schema + UI de provider (Fase 4, implementada)

| Arquivo | Função |
| --- | --- |
| [prisma/schema.prisma](../prisma/schema.prisma) (`WhatsAppInstance`) | Adicionado enum `WhatsAppProvider { UAZAPI, META_CLOUD }`; coluna `provider WhatsAppProvider @default(UAZAPI)`; 5 colunas `meta*` cifradas (`metaAccessToken`, `metaPhoneNumberId`, `metaAppSecret`, `metaVerifyToken`, `metaBusinessAccountId`); índice `@@index([provider])`. Migration `20260609013136_add_whatsapp_provider_and_meta_credentials`. |
| [providers/meta-credentials.ts](../src/features/tracking-chat/lib/providers/meta-credentials.ts) | `encryptMetaCredentialsInput`, `maskMetaCredentials`, `decryptStoredMetaCredentials` (server-only), `MetaCredentialsMissingError`. AES-256-GCM via `@/lib/crypto` + `AI_SECRETS_KEY`. |
| [router/integrations/provider-settings.ts](../src/app/router/integrations/provider-settings.ts) | Procedures oRPC `getProviderSettings` (devolve `{ provider, meta: masked }`) e `setProviderSettings` (grava provider + credenciais cifradas). Role check: owner/admin/moderador (mesma regra do toggle In-Chat). Audit log sem segredos. |
| [hooks/use-whatsapp-provider.ts](../src/features/tracking-settings/hooks/use-whatsapp-provider.ts) | `useWhatsAppProviderSettings(trackingId)` + `useUpdateWhatsAppProviderSettings(trackingId)`. Invalida `integrations.get` também pra UI refletir. |
| [components/whatsapp-provider-settings.tsx](../src/features/tracking-settings/components/whatsapp-provider-settings.tsx) | Card no `chat-settings` com RadioGroup Uazapi/Meta + form de credenciais Meta (5 campos). Placeholder `•••• <last4> (deixe vazio para manter)` quando já gravado. Botão "Remover" zera todos os segredos. Render condicional ao `instance` existir. |
| [components/chat-settings.tsx](../src/features/tracking-settings/components/chat-settings.tsx) | Renderiza `<WhatsAppProviderSettings trackingId={trackingId} />` logo antes do `InChatManualToggle`. |

**Comportamento na Fase 4:** salvar `provider=META_CLOUD` aqui não muda envio/recebimento — Uazapi segue como caminho de produção. A coluna existe e a UI grava credenciais cifradas, mas o `router/message/*` ainda fala Uazapi direto. As Fases 5 e 6 conectarão o switch ao webhook oficial e ao caminho de envio. Isto é deliberado pra permitir provisionamento antes do switch operacional.

> **Atualização Fase 6:** após o merge da Fase 6, gravar `provider=META_CLOUD` **passa a alterar** o envio em tempo real — `resolveOutboundProvider(trackingId)` lê do banco a cada call (cache 30s). O comportamento descrito aqui é histórico da Fase 4.

### 4.5 Webhook oficial (Fase 5, implementada)

| Arquivo | Função |
| --- | --- |
| [app/api/chat/webhook/official/route.ts](../src/app/api/chat/webhook/official/route.ts) | Endpoint compartilhado por todas as instâncias `META_CLOUD`. **GET** = handshake `hub.mode=subscribe&hub.verify_token&hub.challenge` (200 text/plain). **POST** = raw body → extrair `metadata.phone_number_id` → resolver instância via cache → validar HMAC com `appSecret` decifrado → `parseWhatsAppOfficialWebhook` → `provider.normalizeInbound` → loop `persistCanonicalInbound`. Astro-bot intercept em texto puro (paridade com Uazapi). Política anti-retry: 200 em erros de config (tracking_not_found, lead_creation_failed), 500 em race transiente, 401 em HMAC inválido / phone_number_id desconhecido. |
| [inbound/meta-strategies.ts](../src/features/tracking-chat/lib/inbound/meta-strategies.ts) | Strategies Meta-specific: `buildMetaFetchProfilePicture(accessToken)` retorna sempre `null` (Cloud API não expõe foto de contato — só do business próprio), `buildMetaDownloadInboundMedia(accessToken)` via `downloadInboundMedia` da Fase 1 + S3 upload no mesmo bucket Uazapi. |
| [inbound/media-helpers.ts](../src/features/tracking-chat/lib/inbound/media-helpers.ts) | `defaultMimetypeForKind` + `pickExtension` extraídos pra compartilhar entre Uazapi e Meta. Uazapi mantém cópias por ora (refactor opcional). |
| [get-cached-tracking-by-meta-phone-number-id.ts](../src/features/tracking-chat/lib/get-cached-tracking-by-meta-phone-number-id.ts) | Cache in-process do mapeamento `phone_number_id → ResolvedMetaInstance` (credenciais decifradas, TTL 30s). Scan + decrypt em `findMany({ provider: META_CLOUD })` no cold miss (logado com `count` e `elapsedMs` pra observabilidade). `invalidateMetaPhoneNumberIdLookup(id)` invalida 1 entrada; `clearMetaPhoneNumberIdLookupCache()` zera tudo — usado em `setProviderSettings` quando credencial muda. |
| [router/integrations/provider-settings.ts](../src/app/router/integrations/provider-settings.ts) | Atualizada pra chamar `clearMetaPhoneNumberIdLookupCache()` quando `provider` ou qualquer `meta*` muda, evitando que o webhook fique rotando pra estado obsoleto por até 30s. |

**Decisões de design**:

- **Endpoint único compartilhado** — diferente do Uazapi (`?trackingId=...` na query), Meta não permite querystring custom no Webhook URL. Tudo cai aqui, roteamento via `phone_number_id`.
- **Lookup por scan + decrypt** — `metaPhoneNumberId` é cifrado com IV randômico, então `where: { metaPhoneNumberId: <cipher> }` jamais bate. Scan no subset `provider = META_CLOUD` (já indexado) + decifragem em memória custa < 20 ms no cold miss; sub-ms no hit (TTL 30s). Plano de melhoria documentado pra quando passar de ~500 instâncias ativas: coluna `metaPhoneNumberIdHash` SHA-256 indexada → lookup constant-time. Observabilidade já está plugada (log estruturado no cold miss).
- **HMAC validado APÓS lookup do appSecret** — sem o `appSecret` da instância correta, é impossível validar a assinatura. Por isso o handler primeiro extrai o `phone_number_id` cru do JSON (sem Zod) pra achar a instância; só então valida HMAC com o `appSecret` decifrado. Fail-closed: se `phone_number_id` é desconhecido → 401 (não sabemos com qual `appSecret` validar, sinal claro de config errada na Meta App).
- **Política anti-retry Meta**: Meta retenta em backoff exponencial por horas em qualquer não-2xx. Por isso erros que **não se resolvem com retry** viram 200+log (tracking_not_found = config nossa; lead_creation_failed = funil sem status; shape inválido = evento novo). Só 401 (HMAC/phone desconhecido — config Meta errada) e 500 (race transiente). Politica documentada no comentário do handler.
- **Astro-bot intercept** — replica o branch da Uazapi pra texto puro. Webhook-handler do astro-bot já tem branch `META_CLOUD` que devolve `handled=true` + status `provider_not_implemented` (suprime phantom lead). Passamos o `accessToken` decifrado como `receivingInstanceToken` por simetria — Fase 6+ provavelmente refina o branch META_CLOUD lá.

### 4.6 Outbound via factory por-tracking (Fase 6, implementada)

| Arquivo | Função |
| --- | --- |
| [providers/resolve-outbound-provider.ts](../src/features/tracking-chat/lib/providers/resolve-outbound-provider.ts) | **`resolveOutboundProvider(trackingId)`** — único ponto onde os handlers `router/message/*` falam HTTP de provider. Carrega `WhatsAppInstance` por `trackingId` (PK lookup via `@unique`), lê `provider`, decifra credenciais Meta se necessário e instancia o adapter via `createProvider(id, config)`. Devolve `ResolvedOutboundProvider { provider, providerId, instanceId, organizationId, uazapiToken? }`. Cache in-process TTL 30s; `invalidateOutboundProvider(trackingId)` + `clearOutboundProviderCache()` pra mudanças. |
| [providers/outbound-errors.ts](../src/features/tracking-chat/lib/providers/outbound-errors.ts) | Erros estruturados (`OutboundProviderError` base) — `InstanceNotFoundError`, `MetaCredentialsIncompleteError`, `MetaFeatureUnsupportedError`. Handlers mapeiam pra `errors.BAD_REQUEST` do oRPC com `data.code` semântico (`META_FEATURE_UNSUPPORTED` etc.) pro frontend tratar. |
| [router/message/create.ts](../src/app/router/message/create.ts) | Branch WhatsApp resolve provider via `resolveOutboundProvider(trackingId)` e despacha via `provider.sendText(canonical)`. `input.token` mantido no schema por backward compat mas **ignorado** — source of truth é o banco. In-Chat fallback + detecção de ban Uazapi só rodam quando `providerId === "uazapi"`. |
| [router/message/create-with-{image,file,audio,sticker,location,contact}.ts](../src/app/router/message/) | Mesmo padrão: resolve provider → `provider.sendMedia/sendLocation/sendContact` com `SendCanonicalInput`. Áudio mapeia `mediaKind: "audio"` (adapter Uazapi traduz pra `myaudio` internamente). Sticker e document carregam `fileName/mimetype`. |
| [router/message/create-with-buttons.ts](../src/app/router/message/create-with-buttons.ts) | **Gate Meta unsupported.** Carrega `WhatsAppInstance.provider`; se `META_CLOUD`, throw `BAD_REQUEST { code: "META_FEATURE_UNSUPPORTED", feature: "buttons" }` ANTES de cobrar ★. Caso contrário, mantém envio Uazapi-direct (templates HSM não cobertos nesta fase). |
| [router/message/edit.ts](../src/app/router/message/edit.ts) | Gate Meta unsupported (feature `"edit"`). Meta Cloud API não tem endpoint de edição outbound. |
| [router/message/delet-message.ts](../src/app/router/message/delet-message.ts) | Gate Meta unsupported (feature `"delete"`). Meta Cloud API não tem endpoint de delete outbound (só recebe revoke via webhook). |
| [router/message/forward.ts](../src/app/router/message/forward.ts) | Resolve `resolveOutboundProvider(conversation.trackingId)` por destino e injeta `provider` no `ForwardContext`. Strategies não veem mais `token` direto. |
| [forward-strategies/{text,media,contact,location}.ts](../src/features/tracking-chat/lib/forward-strategies/) | `ctx.token` → `ctx.provider`. Cada strategy despacha via `ctx.provider.sendX(...)` canônico. `media.ts` substitui `inferUazapiMediaType` (devolvia `MediaType` Uazapi) por `inferMediaKind` (devolve `CanonicalMediaKind` da PORT). |
| [forward-strategies/types.ts](../src/features/tracking-chat/lib/forward-strategies/types.ts) | `ForwardContext.token: string` removido; `ForwardContext.provider: WhatsAppChatProvider` adicionado. |
| [router/integrations/provider-settings.ts](../src/app/router/integrations/provider-settings.ts) | `setProviderSettings` agora chama `invalidateOutboundProvider(trackingId)` em qualquer mudança de provider/credencial — junto com o `clearMetaPhoneNumberIdLookupCache()` da Fase 5. |
| [providers/adapters/meta-cloud/normalize-phone.ts](../src/features/tracking-chat/lib/providers/adapters/meta-cloud/normalize-phone.ts) | `normalizePhoneToMetaE164(phone)` — strip não-dígitos + insere 9º dígito BR quando o `wa_id` veio com 12 dígitos (`55 DD XXXXXXXX`) pra contas mobile antigas. Idempotente (13 dígitos passam direto). Aplicado em `OfficialProvider.sendText/sendMedia/sendLocation/sendContact` no campo `to`. **Motivo:** Lead.phone fica como a Meta deu no inbound (12 dígitos pra contas antigas), mas allowlist sandbox + maioria das interfaces espera 13 dígitos. Sem isso, Graph devolve `(#131030) Recipient phone number not in allowed list` mesmo com o número certo. |

**Decisões de design**:

- **Provider resolvido server-side, não no payload do cliente.** O cliente continua enviando `token` (Uazapi apiKey) por backward compat, mas o handler **ignora**. Carrega `WhatsAppInstance.provider` direto do banco — single source of truth. Vantagem: trocar provider via UI tem efeito imediato (próximo send), sem precisar deploy/refresh do client.
- **Gate Meta unsupported retorna BAD_REQUEST estruturado com `code` semântico.** Decisão de produto confirmada pelo dono: erro claro > fallback silencioso > best-effort. Frontend pode evoluir pra desabilitar o botão preventivamente quando ler `provider=META_CLOUD` (followup #10).
- **In-Chat fallback + detecção de ban são Uazapi-only.** Meta não bana o número (retorna erros estruturados), e seus erros não acionam o ban detector. `resolved.providerId === "uazapi"` é o gate — sem `providerId` exposto, esse branch viraria dispatch dinâmico no caller.
- **Cache outbound separado do cache do webhook Meta.** São lookups diferentes: webhook = `phone_number_id` (cifrado, scan); outbound = `trackingId` (PK indexado). Compartilhar cache forçaria carregar credenciais que o caminho oposto não precisa.
- **`input.token` segue no schema oRPC.** Remover quebraria todos os clients existentes. Refactor futuro do oRPC pode dropar — não é Phase 6 escopo. Custo: 1 campo no payload sendo ignorado, custo zero em runtime.
- **Normalização do 9º dígito BR fica no adapter Meta, não na pipeline canônica.** `Lead.phone` é a fonte de verdade do `wa_id` (do jeito que a Meta entregou no inbound). O canônico `SendCanonicalInput.to` carrega esse `wa_id` cru. Só o adapter Meta sabe que precisa inserir o 9 antes do POST pro Graph — Uazapi/futuros providers ficam ignorantes do quirk. Alternativa rejeitada: normalizar na entrada (`persistCanonicalInbound`) teria mexido em pipeline crítico e exigido migration de backfill em `Lead.phone` existentes.

---

## 5. Contrato Meta Cloud API (resumo)

### 5.1 Envio

```
POST https://graph.facebook.com/v23.0/{phone_number_id}/messages
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

- **Texto:** `{ messaging_product:"whatsapp", recipient_type:"individual", to:"<e164-sem-+>", type:"text", text:{ body, preview_url? }, context?:{ message_id } }`
- **Mídia:** `{ ..., type:"image"|"audio"|"document"|"sticker"|"video", <type>:{ id|link, caption?, filename? } }`
  - `audio` e `sticker` **não** aceitam `caption`.
  - `document` aceita `filename`.
- **Location:** `{ ..., type:"location", location:{ latitude, longitude, name?, address? } }`
- **Resposta:** `{ messaging_product, contacts:[{input, wa_id}], messages:[{id:"wamid..."}] }` ([send-message.json](../src/http/whats-oficial/jsons/outputs/send-message.json) confirma).

### 5.2 Mídia

| Operação | Endpoint |
| --- | --- |
| Upload | `POST /{phone_number_id}/media` (multipart: `messaging_product=whatsapp`, `type=<mime>`, `file`) → `{ id }` |
| URL fresca | `GET /{media_id}` → `{ url, mime_type, sha256, file_size }` |
| Download binário | `GET <url>` **com** `Authorization: Bearer` (a url lookaside expira ~5 min) |

### 5.3 Webhook

- **GET (verify):** responder `hub.challenge` se `hub.mode=subscribe` e `hub.verify_token` confere.
- **POST:** body com `object: "whatsapp_business_account"`, `entry[].changes[].value.{ metadata, contacts, messages, statuses }`.
- **Assinatura:** header `x-hub-signature-256: sha256=<hmac>` = HMAC-SHA256 do **raw body** com **App Secret**. Validar com `timingSafeEqual`. Fail-closed.

### 5.4 IDs e formato de número

- `wamid.HBgM...` para Meta vs `messageid` Uazapi — convivem em `Message.messageId` (prefixos distintos). Abstraídos como `externalMessageId` na PORT.
- `to`/`from` em **E.164 sem `+`** (ex.: `5586988923098`).

---

## 6. Roadmap

| Fase | Status | Escopo | Critério de pronto |
| --- | --- | --- | --- |
| **1** | ✅ Concluída (2026-06-08) | Clients HTTP crus + verify-signature, isolados em `src/http/whats-oficial/` | Typecheck ok; sandbox envia texto e retorna `wamid`; HMAC self-check passa; chat Uazapi intocado |
| **2** | ✅ Concluída (2026-06-08) | PORT `WhatsAppChatProvider` + tipos canônicos + adapters `UazapiProvider`/`OfficialProvider` em `src/features/tracking-chat/lib/providers/`. Factory como **registry aberto** (N providers) | Typecheck ok; factory aceita `"uazapi"` e `"meta-cloud"`; nenhum import novo em prod (chat continua via `src/http/uazapi/*` direto) |
| **3** | ✅ Concluída (2026-06-08) | Extraída persistência inbound do `route.ts` (1298 → 490 linhas) para `persistCanonicalInbound`. Uazapi roda 100% via caminho canônico; tipos canônicos estendidos com `revoke`, `editedExternalMessageId`, `ownerExternalId`. Strategies Uazapi (avatar + download de mídia) isoladas em `inbound/uazapi-strategies.ts` | Typecheck ok; auditoria de paridade cobriu 28 comportamentos do route antigo (lead create, revoke, edit, quoted, per-type upsert, agent IA, `firePostInboundAutomations`, error codes); chat Uazapi intocado em comportamento |
| **4** | ✅ Concluída (2026-06-08) | Schema (`WhatsAppInstance.provider` + 5 colunas `meta*` cifradas) via migration `20260609013136_add_whatsapp_provider_and_meta_credentials`; helpers cifragem/máscara em `providers/meta-credentials.ts`; procedures oRPC `integrations.{get,set}ProviderSettings` (RBAC owner/admin/moderador); UI em `whatsapp-provider-settings.tsx` (RadioGroup Uazapi/Meta + form de credenciais cifradas com `•••• <last4>` placeholder). `SCHEMA_VERSION` bumpada pra `v37`. Audit log sem segredos | Cliente grava credenciais Meta cifradas via UI, provider visível no banco, typecheck verde, sem afetar envio/recebimento (Uazapi segue intocado) |
| **5** | ✅ Concluída (2026-06-09) | `src/app/api/chat/webhook/official/route.ts` (GET verify `hub.challenge` + POST HMAC fail-closed) reusando `persistCanonicalInbound`. Strategies `buildMeta{FetchProfilePicture,DownloadInboundMedia}`. Lookup `phone_number_id → WhatsAppInstance` via scan+decrypt cacheado 30s (in-process). `setProviderSettings` invalida o cache em mudanças de credenciais. Política anti-retry Meta (200+log em config errada, 500 em race transiente). Astro-bot intercept replicado | Mensagem real do número Meta cria Lead/Conversation/Message via mesmo pipeline canônico do Uazapi, dispara automações idênticas. Typecheck verde, chat Uazapi intocado |
| **6** | ✅ Concluída (2026-06-09) | `resolveOutboundProvider(trackingId)` resolve provider+credenciais por-tracking (cache TTL 30s) e os handlers `router/message/*` despacham via `provider.send*(canonical)`. Erros estruturados `MetaFeatureUnsupportedError` em `edit`/`delete`/`buttons` retornados como `BAD_REQUEST { code: "META_FEATURE_UNSUPPORTED" }`. `forward-strategies/*` migradas pra `ctx.provider` em vez de `ctx.token`. In-Chat fallback + detecção de ban Uazapi gateados por `providerId`. `input.token` mantido por backward compat (ignorado) | Dois trackings em paralelo (um Uazapi, um Meta) enviam sem regressão. Typecheck verde, Uazapi default; Meta ativado por flip do `provider` na UI |

Princípio: cada fase é entregável e testável isoladamente. **Uazapi nunca é removida.**

---

## 7. Decisões & Por quês

| Decisão | Por quê |
| --- | --- |
| Padrão Ports & Adapters | A ideia inicial do dono já estava certa (Strategy + DIP); o time já aplicou no `astro-bot/lib/`; abre a porta para N providers sem refator. |
| Clients crus em `src/http/whats-oficial/` (não em `src/features/`) | `src/http/` é HTTP burro; `src/features/` é domínio. Regra do CLAUDE.md. |
| PORT vive em `src/features/tracking-chat/lib/providers/` | Atendimento humano é o domínio `tracking-chat`. PORT é regra de negócio, não HTTP cru. |
| Fase 1 = só os clients crus | Menor fatia segura; zero risco para o chat Uazapi de produção. |
| Default `UAZAPI` no schema (Fase 4) | Migração puramente aditiva (colunas nullable); todo tracking existente segue Uazapi até o cliente trocar. |
| Endpoints de webhook separados por provider | Sem cross-talk; cada tracking recebe só onde seu webhook aponta; rollback simples. |
| Endpoint Meta **único** compartilhado por todas as instâncias `META_CLOUD` (Fase 5) | Meta não permite querystring custom no Webhook URL (URL é fixa por App configurada). Diferente do Uazapi (`?trackingId=...`), o roteamento Meta acontece via `metadata.phone_number_id` no payload + lookup `WhatsAppInstance.metaPhoneNumberId`. Aceitamos isso porque a Meta App é por-organização (e o número é único globalmente nela). |
| Lookup `phone_number_id → WhatsAppInstance` via scan + decrypt (Fase 5) | `metaPhoneNumberId` é cifrado com IV randômico (AES-GCM): `where: { metaPhoneNumberId: cipher }` jamais bate. Scan no subset `provider = META_CLOUD` + cache 30s in-process resolve em ~10-20ms cold, sub-ms hit. Universo esperado: dezenas/baixas centenas no 1º ano — adicionar coluna hash agora é otimização prematura. Plano (b) documentado pra quando cruzar threshold. |
| Política anti-retry Meta no webhook oficial (Fase 5) | Meta retenta com backoff exponencial por horas em qualquer não-2xx. Para evitar dead-letter, erros que **não se resolvem com retry** (config errada nossa: tracking_not_found, funil sem status, shape novo) viram 200 + log. Só HMAC inválido / phone desconhecido (401) e race transiente (500) escapam. |
| Reusar `firePostInboundAutomations` (Fase 3) | Evita duplicar as 1298 linhas do `route.ts`; ambos os providers convergem no mesmo pipeline pós-inbound. |
| Onde guardar credenciais Meta — `WhatsAppInstance.meta*` (Fase 4) | Confirmada: estender `WhatsAppInstance` mantém 1:1 com tracking sem JOIN novo, reaproveita `provider` no mesmo lugar do `apiKey`/`baseUrl` Uazapi, e o CASCADE de delete já cobre. Tudo cifrado via `@/lib/crypto`. |
| Switch de provider grava sem efeito operacional (Fase 4) | Permite cliente preparar credenciais antes do webhook oficial (Fase 5) entrar — separação clara entre provisionamento e mudança de comportamento, reduz risco. |
| **Gate META_CLOUD na Fase 5**: `setProviderSettings` recusa o switch sem as 4 credenciais Meta obrigatórias (UI também desabilita o Save). | Pós-Fase 5 trocar pra Meta sem credenciais não é mais "no-op" — vira bug (webhook responde 401 silenciosamente, Meta retenta). Defense in depth no backend + warning na UI. |
| **Idempotência de re-entregas Meta** garantida via `prisma.message.upsert({ where: { messageId: externalMessageId } })` em todos os branches de persistência (text/media/location/contact/interactive/sticker). | Meta reentrega em qualquer 5xx por horas. `wamid` é único por mensagem — re-entrega vira no-op silencioso. Sem necessidade de tabela de deduplicação externa. Sticker era `create` sem upsert pré-Fase 5 (paridade Uazapi, que não retentava); migrado pra `upsert` no commit da Fase 5. |
| **Cache só com hits + cap defensivo** em `get-cached-tracking-by-meta-phone-number-id`. | Pra evitar DoS por memory exhaustion: atacante poderia enviar POSTs com `phone_number_id` aleatórios distintos antes da validação HMAC (HMAC só roda depois do lookup). Misses não entram no map; cap de 5.000 entradas + sweep de expiradas/LRU. |
| **Multi-entry com `phone_number_id` distintos** → 200 + skip + log. | Meta normalmente entrega 1 entry por POST mas o shape permite N WABAs. Como o HMAC é com o `appSecret` da App e o lookup é por instância (cada uma com seu appSecret), multi-distinct é cenário ambíguo. Rejeitamos pra evitar gravar mensagens no tracking errado. |
| **Astro-bot intercept Meta só se 1 mensagem no POST** | Meta agrupa N messages por POST. Se interceptamos a primeira como comando bot e retornamos 200, perderíamos as outras (mídia + texto subsequente do mesmo POST). Conservador: bot só atua quando o POST é exclusivo de uma mensagem texto. |
| **CTWA via `referral` preservado** passando `[rawMessage, parsed]` em `ctwaSources`. | O canônico normalizado perde o `referral` cru (vive em `messages[].referral` do envelope). Sem reconstruir o `rawMessage` via wamid antes de `persistCanonicalInbound`, todo Lead criado via Meta perderia atribuição CTWA (gasto pago zerado em relatórios). |

---

## 8. Riscos & Armadilhas

| Risco | Mitigação |
| --- | --- |
| Janela de 24h da Meta (texto livre só dentro dela) | `OfficialProvider.sendText` (Fase 2) detecta erros `131047`/`131051` e devolve erro semântico; PORT reservará espaço para `sendTemplate`. |
| Detecção de ban Uazapi-only | No caminho Official, `429`/token expirado **não** acionam `markInstanceConnectionFailure` (semântica distinta). |
| `x-hub-signature-256` é sobre RAW body | Handler (Fase 5) deve ler `request.text()` antes de qualquer parse; já refletido em `verify-signature.ts`. |
| URL lookaside expira (~5 min) | Sempre baixar mídia inbound na hora e subir no R2 — nunca persistir a URL crua. |
| Templates obrigatórios (HSM) na Meta | Decisão de produto na Fase 6: trackings `OFFICIAL` precisam de pelo menos um template "abertura". |
| Access token / App Secret | Cifrados via `@/lib/crypto` + `AI_SECRETS_KEY` no banco (Fase 4 ✅); UI nunca recebe o segredo de volta — só `hasX`/`lastX`; audit log sem segredos. |
| `fromMe` / eco | Meta **não** ecoa via webhook as mensagens que você enviou (diferente da Uazapi). `Message{fromMe:true}` no Official vem só do caminho outbound. |
| Verify token compartilhado entre múltiplos trackings | `WhatsAppInstance.metaVerifyToken` por instância cobre o caso (Fase 4 ✅). |

---

## 9. Variáveis de Ambiente

### Fase 1 (env local, só para teste manual no sandbox)

| Variável | Função |
| --- | --- |
| `WHATSAPP_OFICIAL_ACCESS_TOKEN` | System User access token (long-lived). Sandbox temporário no Meta App. |
| `WHATSAPP_OFICIAL_PHONE_NUMBER_ID` | Phone Number ID do número de testes do Meta App. |
| `WHATSAPP_OFICIAL_APP_SECRET` | App Secret para validar HMAC `x-hub-signature-256`. |
| `WHATSAPP_OFICIAL_VERIFY_TOKEN` | `hub.verify_token` do GET de subscription. |
| `WHATSAPP_OFICIAL_TEST_TO` | Número destino do teste de envio (E.164 sem `+`). |
| `WHATSAPP_OFICIAL_GRAPH_BASE_URL` (opcional) | Override de `https://graph.facebook.com/v23.0`. |

### Fases finais

Credenciais por-tracking vivem no banco (`WhatsAppInstance.meta*`, cifradas). Env globais ficam só para overrides operacionais.

---

## 10. Changelog

| Data | Mudança |
| --- | --- |
| 2026-06-09 | **Bug 1 do code review corrigido + 12 findings registrados como followups (§12.1).** Code review adversarial xhigh (9 ângulos + verifier por candidato + sweep) levantou 13 findings. Bug 1 (empty `wamid` corrompendo `Message.messageId @unique`) corrigido **no PR da Fase 6** com defesa em 3 camadas: (a) `extractWamid(response, op)` no `OfficialProvider` que joga `ProviderSendInvalidResponseError` (subclasse de `OutboundProviderError`, code `PROVIDER_SEND_INVALID_RESPONSE`) em vez de `?? ""`; (b) `extractUazapiId(response, op)` simétrico no `UazapiProvider` (workflow adversarial revelou o mesmo padrão); (c) guard defensivo em `persistCanonicalInbound` que pula+log `empty_external_message_id` se canônico chegar com id vazio. Os 12 restantes (Bugs 2-13) registrados como followups #11-22 no §12.1 com severidade, trigger e plano de execução. Typecheck verde. |
| 2026-06-09 | **Fix BR 9º dígito (smoke Fase 6).** Smoke test do envio Meta retornou `(#131030) Recipient phone number not in allowed list` mesmo com o destino na allowlist — diagnóstico: `wa_id` de conta mobile antiga vem com 12 dígitos (sem o 9) no inbound da Meta, mas allowlist sandbox tem 13. `Lead.phone` salvo cru (12) → `to` enviado cru → mismatch. Fix: novo helper `normalizePhoneToMetaE164` em `providers/adapters/meta-cloud/normalize-phone.ts` (strip não-dígitos + insere 9 entre DDD e os 8 finais quando length=12 e starts="55"), aplicado nos 4 sends do `OfficialProvider`. Idempotente, isolado no adapter (Uazapi e Lead.phone intocados). Typecheck verde. |
| 2026-06-09 | **Fase 6 concluída.** Outbound resolve provider via `resolveOutboundProvider(trackingId)` (novo helper em `src/features/tracking-chat/lib/providers/resolve-outbound-provider.ts`, cache in-process TTL 30s) e despacha via PORT (`provider.sendText/sendMedia/sendLocation/sendContact`). Refatorados: `router/message/create.ts`, `create-with-{image,file,audio,sticker,location,contact}.ts`, `forward.ts` (provider injetado no `ForwardContext`), todas as `forward-strategies/{text,media,contact,location}.ts` (eliminado import direto de `@/http/uazapi/*`). `input.token` segue no schema oRPC por backward compat, mas é **ignorado** — single source of truth virou `WhatsAppInstance.provider`+credenciais cifradas. Gates Meta-unsupported (BAD_REQUEST estruturado com `code: "META_FEATURE_UNSUPPORTED"`) adicionados em `create-with-buttons.ts`, `edit.ts`, `delet-message.ts`. In-Chat fallback + `markInstanceConnectionFailure` Uazapi-only (`if (providerId === "uazapi")`). `setProviderSettings` invalida o novo cache outbound junto com o cache de `phone_number_id`. Helper `inferUazapiMediaType` substituído por `inferMediaKind` (canônico) no `forward-strategies/media.ts`. Typecheck do projeto inteiro: exit 0 (~8GB heap). Branch: `feature/tracking-chat-whatsapp-oficial-outbound-wiring-20260609`. |
| 2026-06-09 | **Fase 5 concluída.** Webhook oficial Meta em `src/app/api/chat/webhook/official/route.ts` (GET handshake + POST HMAC fail-closed). Roteamento por `phone_number_id` extraído do envelope, com lookup via `getCachedTrackingByMetaPhoneNumberId` (cache in-process TTL 30s, scan + decrypt das instâncias `META_CLOUD`; log estruturado no cold miss pra observar quando migrar pra coluna hash). Strategies Meta em `meta-strategies.ts`: `buildMetaDownloadInboundMedia` (via `downloadInboundMedia` da Fase 1 + S3) e `buildMetaFetchProfilePicture` (sempre `null` — Cloud API não expõe foto de contato). Helpers `defaultMimetypeForKind`/`pickExtension` extraídos pra `media-helpers.ts` (compartilhado entre Uazapi/Meta). Política anti-retry Meta: 200+log em config errada (`tracking_not_found`, `lead_creation_failed`, shape inválido); 401 em HMAC inválido / `phone_number_id` desconhecido (param congelado anti-loop); 500 em race transiente (`lead_reload_failed`, `conversation_missing`). Astro-bot intercept replicado pra texto puro. `setProviderSettings` invalida o cache de lookup quando provider/credenciais mudam. **Review adversarial paralelo** (security/correctness/completeness) pegou 13 findings; os high+medium foram corrigidos no mesmo commit: (a) **CTWA preservado** via `Map<wamid, rawMessage>` passando `[rawMessage, parsed]` em `ctwaSources`; (b) **multi-`phone_number_id` distintos no POST** → 200+skip+log (cenário ambíguo de HMAC); (c) **astro-bot só intercepta se 1 mensagem texto no POST** (Meta agrupa N por POST — evita descartar mídia subsequente); (d) **sticker `create` → `upsert`** (Meta reentrega; idempotência via wamid); (e) **gate `setProviderSettings`** rejeita `META_CLOUD` sem as 4 credenciais Meta obrigatórias + UI desabilita Save; (f) **cache só hits + cap 5k + sweep** anti-DoS; (g) **GET handshake constant-work + `timingSafeEqual`** anti-timing-leak; (h) **log `statusUpdates` count** pra observabilidade Fase 6. Typecheck do projeto inteiro: exit 0. Branch: `feature/tracking-chat-whatsapp-oficial-webhook-20260609`. |
| 2026-06-08 | **Fase 4 concluída.** Schema: enum `WhatsAppProvider { UAZAPI, META_CLOUD }` + coluna `WhatsAppInstance.provider` (default `UAZAPI`) + 5 colunas cifradas `metaAccessToken`/`metaPhoneNumberId`/`metaAppSecret`/`metaVerifyToken`/`metaBusinessAccountId` + `@@index([provider])`. Migration aplicada (`20260609013136_add_whatsapp_provider_and_meta_credentials`); `SCHEMA_VERSION` bumpada pra `v37-whatsapp-provider-meta-credentials`; ritual pós-migration completo (db:generate + bump + touch catch-all). Helpers em `src/features/tracking-chat/lib/providers/meta-credentials.ts` (`encryptMetaCredentialsInput`, `maskMetaCredentials`, `decryptStoredMetaCredentials`, `MetaCredentialsMissingError`). Procedures oRPC: `integrations.getProviderSettings` (devolve `{ provider, meta: { hasX, lastX } }`) e `integrations.setProviderSettings` (cifra e grava; role check owner/admin/moderador via `canToggleInChatManual`; audit log sem segredos). UI: `WhatsAppProviderSettings` no `chat-settings` com RadioGroup Uazapi/Meta + form de 5 campos com placeholder `•••• <last4> (deixe vazio para manter)` + botão "Remover" pra zerar segredos. Comportamento intocado: gravar `META_CLOUD` aqui **não** muda envio/recebimento — Fases 5 e 6 conectam o switch. Typecheck do projeto inteiro: exit 0. Branch: `feature/tracking-chat-whatsapp-oficial-schema-20260608`. |
| 2026-06-08 | **Fase 3 concluída.** Pipeline canônica inbound implementada em `src/features/tracking-chat/lib/inbound/persist-canonical-inbound.ts` (~720 linhas) + strategies Uazapi em `inbound/uazapi-strategies.ts`. Tipos canônicos estendidos: `editedExternalMessageId`, `ownerExternalId`, `CanonicalInboundRevoke`. `UazapiProvider.normalizeInbound` completado pra cobrir todos os tipos do route antigo (text/extended/conversation/image/video/audio/document/sticker/location/contact/interactive/protocol-revoke/edited/quoted). `src/app/api/chat/webhook/route.ts` caiu de 1298 → 490 linhas; o branch `messages` agora normaliza → loop persistCanonicalInbound. Branches `connection`/`calls`/`labels`/`chat_labels` intactas. Auditoria de paridade interna pegou 3 regressões e foram corrigidas: (a) `lead_creation_failed` agora retorna 400 "Status context not found" (paridade com route antigo); (b) extensão fallback de documento é `pdf` (não `bin`); (c) áudio mantém `update: {}` idempotente (não toca em `createdAt`/`status` em re-entrega). Typecheck do projeto inteiro: exit 0. Branch: `feature/tracking-chat-whatsapp-oficial-pipeline-canonical-20260608`. |
| 2026-06-08 | **Estratégia de branch de integração formalizada.** Criada `feature/whatsapp-oficial-integration` a partir de `origin/main`. PR #297 (Fases 1+2) retargetado: base agora é a integração, não `main`. CLAUDE.md ganhou item 14 com as regras: branches de fase nascem da integração; PRs de fase têm base integração; só o PR final mergeia a integração em `main`. Seção §2.1 adicionada a este documento explicando o porquê. |
| 2026-06-08 | **Fase 2 concluída.** PORT `WhatsAppChatProvider` + tipos canônicos (`types.ts`), factory aberta a N providers via registry (`factory.ts`), adapters `UazapiProvider` e `OfficialProvider` (cobrindo send + normalizeInbound + verifyWebhook), e `index.ts` com side-effect imports que auto-registram os adapters. Typecheck do projeto inteiro: exit 0. Único diretório alterado: `src/features/tracking-chat/lib/providers/`. Chat Uazapi: intocado — `router/message/*` e `route.ts` continuam falando Uazapi direto até a Fase 6. Branch: `feature/tracking-chat-whatsapp-oficial-port-adapters-20260608`. |
| 2026-06-08 | **Fase 1 validada ponta-a-ponta.** Envio real no sandbox Meta retornou `wamid` e mensagem chegou no WhatsApp. HMAC self-check (3/3) e parse de fixtures (7/7) verdes. Typecheck do projeto inteiro: exit 0. Chat Uazapi: intocado. |
| 2026-06-08 | **Fase 1 implementada.** Clients HTTP crus em `src/http/whats-oficial/`: `client.ts`, `send-{text,media,location,contact}.ts`, `upload-media.ts`, `get-media.ts`, `webhook-schema.ts` (Zod), `verify-signature.ts` (HMAC + `timingSafeEqual`), `types.ts`, `index.ts` (barrel re-export — substitui o esboço SOLID original), `playground/send-test.ts` (tsx). |
| 2026-06-08 | **Fase 1 iniciada.** Plano aprovado. Branch `feature/tracking-chat-whatsapp-oficial-clients-meta-20260608`. Documento vivo criado. CLAUDE.md item 13 grava a regra de manter este documento atualizado. |

---

## 11. Validação local (Fase 5 — receber mensagem real)

Sem deploy / sem playground dedicado. Checklist mínimo pra confirmar que o webhook está ponta-a-ponta:

1. **Provisionar credenciais no banco** via UI:
   - `pnpm dev` + abrir um tracking com instância Uazapi conectada → Configurações → Atendimento → **Provider WhatsApp**.
   - RadioGroup em **Meta Cloud API**, preencher Access Token / Phone Number ID / App Secret / Verify Token (do Meta App sandbox). O botão Save só habilita quando as 4 estão preenchidas.
2. **Tunelar a porta local** com ngrok / Cloudflare Tunnel:
   ```bash
   ngrok http 3000
   # ex: https://abcd-1234.ngrok-free.app
   ```
3. **Configurar webhook no Meta App**:
   - Painel da Meta → App → WhatsApp → Configuration → Webhooks.
   - Callback URL: `https://<tunnel>/api/chat/webhook/official`
   - Verify token: o **mesmo** valor gravado no passo 1 (`verify_token`).
   - Subscribe nos campos `messages` e `message_status`.
   - O GET handshake deve retornar 200 com o `hub.challenge` ecoado.
4. **Enviar mensagem do celular pessoal** pro número Meta sandbox.
5. **Verificar criação do Lead/Conversation/Message**:
   - `pnpm db:studio` → tabelas `Lead`, `Conversation`, `Message` no tracking esperado.
   - Ou recarregar `/chat/<trackingId>` no app — o lead novo deve aparecer na coluna inicial do funil.
6. **Smoke de mídia**: enviar uma imagem do celular; conferir `Message.mediaUrl` populado (key S3) e visualização no chat.
7. **Smoke de re-entrega (opcional)**: forçar 500 manualmente uma vez (ex: parar o app a meio request), reiniciar, esperar Meta reentregar — a re-entrega deve ser no-op (upsert por `messageId`).

Se algum passo falha, conferir logs por:
- `[webhook:official:GET] decrypt_failed` → credencial corrompida.
- `[webhook:official:POST] invalid_signature` → App Secret errado no banco vs no Meta App.
- `[webhook:official:POST] unknown_phone_number_id` → Phone Number ID gravado no banco diferente do que a Meta entrega.
- `[meta-phone-lookup] cold_miss matched=false` → idem.

---

## 12. Followups conhecidos

Itens listados aqui não bloqueiam mergeio da Fase 5 — são endereços de melhoria operados depois com evidência (telemetria/tickets).

| # | Item | Trigger pra implementar | Como |
| --- | --- | --- | --- |
| 1 | Migrar lookup pra `metaPhoneNumberIdHash` indexada | `count(META_CLOUD) > 500` OU p95 cold miss > 50ms | Migration aditiva + backfill (decifrar + SHA-256). Lookup vira `findUnique` constant-time. Comentário em `get-cached-tracking-by-meta-phone-number-id.ts` topo. |
| 2 | Pluggar `cold_miss` em métrica/alerta | Time tiver pipeline Prometheus/Sentry/datadog | Trocar `console.log` por emit de métrica (`elapsedMs`, `matched`, `candidates`). |
| 3 | Astro-bot branch META_CLOUD funcional | Cliente em `META_CLOUD` reclamar de bot fora do ar | Em `src/features/astro-bot/lib/webhook-handler.ts` linha 97-106, implementar verify por `metaPhoneNumberId` igual ao branch UAZAPI faz por `apiKey`. |
| 4 | Persistir `statusUpdates` (delivered/read/failed) | Cliente abrir ticket de "ticks azuis não aparecem em Meta" | Estender `persistCanonicalInbound` com branch `statusUpdates` que faz `UPDATE Message SET status = ... WHERE messageId = ...`. Log já registra contagem desde Fase 5. |
| 5 | Astro-bot intercept multi-mensagem | Cliente abrir ticket de "comando bot não funcionou quando mandei junto" | Hoje só intercepta POSTs com 1 mensagem. Melhoria: interceptar texto identificado como bot e persistir as outras mensagens do mesmo POST via `persistCanonicalInbound`. |
| 6 | `interactive_reply` no intercept astro-bot | Quando começar a enviar botões pra membros via bot | Hoje só checa `type === "text"`. Aceitar `interactive_reply.replyText` como fonte do `messageText`. |
| 7 | Auto-desabilitar instância órfã (tracking deletado) | Spam de `tracking_not_found_for_instance` em logs | Quando handler detecta o caso, marcar a instância como `isActive: false` + invalidar cache. |
| 8 | Decisão sobre fixtures de teste local | Antes de deprecar mudança nas fixtures `jsons/webhooks/` | Criar `src/http/whats-oficial/playground/post-webhook.ts` que lê fixture + computa HMAC + POSTa em `localhost:3000/api/chat/webhook/official`. Permite smoke sem ngrok. |
| 9 | **Gate `provider` no webhook Uazapi (inbound exclusivity)** | Antes do primeiro cliente migrar Uazapi→Meta em produção SEM desligar o webhook Uazapi externo (cenário muito provável: a maioria não vai lembrar de remover o webhook na Uazapi). Sintoma: mensagens duplicadas — uma via Meta, outra via Uazapi. | `/api/chat/webhook?trackingId=X` hoje aceita qualquer POST Uazapi sem checar `WhatsAppInstance.provider`. O webhook Meta JÁ filtra por `provider=META_CLOUD` no lookup, mas o caminho Uazapi não tem o gate simétrico. Fix: na entrada do `POST` handler em `src/app/api/chat/webhook/route.ts`, antes do `getCachedTrackingContext`, fazer lookup leve de `WhatsAppInstance.provider` por `trackingId` (preferencialmente estender o `getCachedTrackingContext` pra trazer o `provider`, evitando query extra) e retornar 200+log `provider_mismatch` se `provider !== "UAZAPI"`. 200 (não 4xx) porque a Uazapi externa retenta com backoff em não-2xx — não queremos amplificar o problema. Estimativa: ~30 linhas + bump no cache. |
| 10 | **UI gating preventivo de features Meta-unsupported** | Toast de erro depois do clique é OK pra ship; mas a UX melhora muito se o botão de editar/apagar/botões já apareça desabilitado quando o tracking estiver em `META_CLOUD`. | Frontend lê `useWhatsAppProviderSettings(trackingId)` (já existe — Fase 4) no `tracking-chat`. Quando `data.provider === "META_CLOUD"`: desabilitar botões "Editar mensagem" + "Apagar mensagem" no `message-box` + esconder/desabilitar a aba de Botões interativos no compose. Tooltip explicando "Meta Cloud API não suporta essa operação". Estimativa: ~50 linhas + 1 hook helper `useWhatsAppFeatureGate(trackingId)`. |

### 12.1 Followups vindos do code review xhigh da Fase 6 (2026-06-09)

Code review adversarial (9 ângulos + verifier por candidato + sweep) levantou 13 findings; #11–22 abaixo são os 12 que ficaram pra depois (Bug 1 já corrigido no PR da Fase 6). Severidade: **🔴 high** (corrigir antes de adoção em prod com >1 cliente em Meta), **🟡 medium** (vale uma janela de manutenção), **🟢 cleanup** (refactor oportunista).

| # | Severidade | Item | Trigger pra implementar | Como |
| --- | --- | --- | --- | --- |
| 11 | 🔴 high | **Cache outbound fica stale em 10 mutation sites** | Antes do primeiro cliente que troque QR / reconecte / sofra ban auto-detection em produção com Meta ativo. Sintoma: mensagem enviada com token antigo, ou tentativa de envio pra instância recém-deletada por até 30s. | Adicionar `invalidateOutboundProvider(trackingId)` em: `src/app/api/chat/webhook/route.ts:201` (disconnect via webhook), `src/features/tracking-chat/lib/in-chat-mode.ts:207/289/361` (ban detection + In-Chat ativação/healthy), `src/app/router/integrations/conect.ts:54` (reconnect — muda `apiKey`), `disconect.ts:33`, `delet.ts:48`, `import-existing-chats.ts:188`. Pro cascade `Organization.delete → WhatsAppInstance.delete`, usar Prisma extension/middleware OU chamar `clearOutboundProviderCache()` no fluxo de delete-org. Estimativa: ~30 linhas + 1 helper compartilhado. |
| 12 | 🔴 high | **`normalizePhoneToMetaE164` corrompe fixos BR de 12 dígitos** | Antes do 1º cliente cadastrar lead manual ou importar CSV com telefone fixo BR. Sintoma: Meta sendo invocada com número inexistente → 131030 ou (pior) entrega ao número errado. | Tightening em `src/features/tracking-chat/lib/providers/adapters/meta-cloud/normalize-phone.ts`: só inserir `9` quando `digits.length === 12 && digits.startsWith("55") && (digits[4] === "8" \|\| digits[4] === "9")` — mobile BR antigo sempre começava com 8 ou 9 (fixos começam com 2-5). Adicionalmente: validar phone no `createLead`/`createLeadWithTags`/import CSV pra rejeitar < 13 dígitos quando country code = 55. ~15 linhas em normalize-phone + ~30 linhas de validação no Zod dos forms. |
| 13 | 🔴 high | **Estrela cobrada antes do resolver poder lançar** | Cliente reclamar "fui cobrado mas a mensagem não saiu". Especialmente provável durante janelas de reconfiguração de Meta credentials (resolveOutboundProvider throws → org perdeu ★). | Reordenar nos 7 send handlers (`create.ts`, `create-with-{image,file,audio,sticker,location,contact}.ts`): `resolveOutboundProvider(trackingId)` PRIMEIRO, `chargeMessageOutbound` DEPOIS. Ou (alternativa segura) wrap num `try/catch` no charge que dispara refund via novo helper `refundMessageOutbound`. Decisão de produto: refund automático vs falha + log? Estimativa: ~40 linhas (movimentação de blocos). |
| 14 | 🔴 high | **Erros do resolver retornam 500 em vez de BAD_REQUEST estruturado** | Quando frontend precisar mostrar UI específica pra "configure instância" vs erro genérico. Pode esperar Bug 1 já estar com `ProviderSendInvalidResponseError` retornando estruturado em produção. | Wrap `resolveOutboundProvider(trackingId)` num try/catch nos 8 handlers (`create.ts:137`, `create-with-{image,file,audio,sticker,location,contact}.ts`, `forward.ts:82`) que detecte `OutboundProviderError` subclass → `errors.BAD_REQUEST({ data: { code: err.code } })`. Os 3 gated handlers (buttons/edit/delete) já fazem isso — copiar padrão. Estimativa: criar helper `mapOutboundError(err, errors)` e chamar nos 8 sites. ~80 linhas. |
| 15 | 🟡 medium | **`forward.ts` perde `code` do erro via `String(err)`** | Quando #14 estiver feito e atendentes começarem a usar "encaminhar pra múltiplas conversas" — eles vão receber `"Error: Nenhuma instância..."` em vez de erro tratado por destino. | `src/app/router/message/forward.ts:114`: substituir `String((result as PromiseRejectedResult).reason)` por helper `serializeOutboundError(err): { message: string; code?: string; feature?: string }` que preserva campos de `OutboundProviderError`. Frontend pode iterar `result.errors` e renderizar conforme `code`. Estimativa: ~25 linhas. |
| 16 | 🟡 medium | **Uazapi `readmessages: true` / `readchat: true` removidos silenciosamente** | Cliente em Uazapi reclamar "marquei mensagem como lida no NASA mas o lead vê unread badge no celular dele". Existia pré-Fase 6, perdido na refactor. | Adicionar `markPreviousAsRead?: boolean` no `SendBase` (default `true`) em `src/features/tracking-chat/lib/providers/types.ts`. `UazapiProvider` passa pra Uazapi como `readmessages: true, readchat: true`. `OfficialProvider` ignora (Meta não tem endpoint equivalente outbound). Estimativa: ~20 linhas em 3 arquivos. |
| 17 | 🟡 medium | **Cache outbound sem cap de tamanho** | `count(WhatsAppInstance with active activity) > 500` OU monitoramento mostrar memory growth monotônico no processo Node. | Copiar padrão do `src/features/tracking-chat/lib/get-cached-tracking-by-meta-phone-number-id.ts`: `MAX_ENTRIES = 5000` + `sweepIfFull()` que limpa expiradas e (se ainda passar) descarta as mais antigas via `Map.keys().next()`. ~30 linhas em `resolve-outbound-provider.ts`. |
| 18 | 🟢 cleanup | **`create-with-sticker.ts` não chama `chargeMessageOutbound`** | Pré-existente (não introduzido pela Fase 6, mas tocado pela refactor então em escopo). Toda hora que cliente envia sticker, perde ★ de receita. | Adicionar `await chargeMessageOutbound({ organizationId, userId, channel: "whatsapp", mediaType: "sticker" })` no início do handler em `src/app/router/message/create-with-sticker.ts:57`, ANTES do `resolveOutboundProvider`. Trade-off com Bug #13 (estrela cobrada antes do resolver) — fazer #13 primeiro, depois adicionar charge no sticker no padrão correto. |
| 19 | 🟢 cleanup | **3 handlers gateados fazem `findUnique` extra só pra ler `provider`** | Carga aumentar OU monitoramento mostrar p99 alta em `edit`/`delete`/`buttons`. | Em `src/app/router/message/edit.ts:26-52`, `delet-message.ts:27-52`, `create-with-buttons.ts:64-76`: na query existente que já carrega `conversation` ou `message`, incluir `tracking: { select: { whatsAppInstance: { select: { provider: true } } } }`. Deletar a segunda `prisma.whatsAppInstance.findUnique`. Estimativa: ~30 linhas removidas. |
| 20 | 🟢 cleanup | **`input.token` required-but-ignored em 7 handlers** | Refactor planejado do oRPC schema OU criação de novo cliente (mobile, integração 3rd-party). | Marcar `token: z.string().optional()` nos 7 send handlers (`create`, `create-with-{image,file,audio,sticker,location,contact}`, `forward`) + JSDoc `@deprecated Use server-side provider resolution`. Manter `token` ativo em `edit`/`delete`/`create-with-buttons` (ainda em uso). Plano de remoção: PR separado depois que app web parar de enviar. |
| 21 | 🟢 cleanup | **`.catch(() => {})` engole erros do `markInstanceConnectionFailure`** | Investigação de bug "In-Chat fallback não ativou". Hoje impossível depurar sem repro local. | Substituir `markInstanceConnectionFailure({...}).catch(() => {})` por `markInstanceConnectionFailure({...}).catch(err => console.error("[in-chat-mode] markInstanceConnectionFailure failed", { source: "send_failure", error: err instanceof Error ? err.message : String(err) }))`. **CUIDADO:** NÃO logar `apiKey` em claro — usar `last4(apiKey)` se quiser identificar. Aplicar nos 7 handlers de send. ~14 linhas. |
| 22 | 🟢 cleanup (altitude) | **`uazapiToken` na PORT vaza specifics do Uazapi** | Quando entrar a 3ª provider (Twilio/Vonage) OU refactor planejado da PORT. | Substituir o campo `uazapiToken?: string` em `ResolvedOutboundProvider` por método na PORT: `provider.markFailure(reason: 'ban' \| 'rate_limit' \| 'auth_expired'): Promise<void>`. Cada adapter decide o que persistir internamente (`UazapiProvider.markFailure` chama `markInstanceConnectionFailure`; `OfficialProvider.markFailure` no-op por enquanto). Handlers param de fazer `if (resolved.providerId === "uazapi")`. Estimativa: ~60 linhas + refactor de 7 handlers. |
