# WhatsApp Oficial (Meta Cloud API) — Visão Geral

> Documento vivo da integração com a **API Oficial do WhatsApp Business (Meta Cloud API)** no NASA. Última revisão: 2026-06-08 (Fase 2 — PORT + adapters).
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
| Fase em andamento | **Fase 2 concluída ✅** — pronta para Fase 3 (pipeline canônico) |
| Provider em produção | **Uazapi (100%)** — chat segue intocado |
| Meta Cloud API | Clients HTTP em `src/http/whats-oficial/` + PORT/adapters em `src/features/tracking-chat/lib/providers/`, sem wiring em prod |
| App Meta configurada | Sim (sandbox, número de testes) |
| Webhook real recebendo | Configurado em `n8n.nasaex.com/webhook/whats` (capturas em `jsons/webhooks/`) |

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
4. **Webhooks** — um endpoint por provider (`/api/chat/webhook` Uazapi vs `/api/chat/webhook/official` Meta), ambos convergindo no pipeline canônico.
5. **Schema** — `WhatsAppInstance.provider` + credenciais por-provider (cifradas com `@/lib/crypto` + `AI_SECRETS_KEY`). Decisão de modelagem na Fase 4.

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

### 4.2 PORT + adapters (Fase 2, implementados)

| Arquivo | Função |
| --- | --- |
| [providers/types.ts](../src/features/tracking-chat/lib/providers/types.ts) | PORT `WhatsAppChatProvider` + `CanonicalInboundMessage` (union por `type`) + `SendCanonicalInput` + `SendResult` + `ProviderId` (string extensível) |
| [providers/factory.ts](../src/features/tracking-chat/lib/providers/factory.ts) | `registerProvider`/`createProvider`/`listRegisteredProviders` + `UnknownProviderError`. Registry `Map<ProviderId, ProviderBuilder>` — **aberto a N providers** |
| [providers/adapters/uazapi/provider.ts](../src/features/tracking-chat/lib/providers/adapters/uazapi/provider.ts) | `UazapiProvider implements WhatsAppChatProvider`. Mapeia send canônico↔Uazapi (`MediaType`), normaliza `messagesEventSchema` da Uazapi → canônico. Auto-registra como `"uazapi"` |
| [providers/adapters/meta-cloud/provider.ts](../src/features/tracking-chat/lib/providers/adapters/meta-cloud/provider.ts) | `OfficialProvider implements WhatsAppChatProvider`. Mapeia send canônico↔Meta, normaliza envelope completo (`entry[].changes[].value.{messages,statuses}`) incluindo mídia, reaction, button/interactive. `verifyWebhook` delega a `isMetaSignatureValid`. Auto-registra como `"meta-cloud"` |
| [providers/index.ts](../src/features/tracking-chat/lib/providers/index.ts) | Barrel: re-exports + **side-effect imports** dos dois adapters (registro automático) |

### 4.3 Pipeline canônico inbound (Fase 3, ainda não criado)

| Caminho previsto | Função |
| --- | --- |
| `src/features/tracking-chat/lib/inbound/persist-canonical-inbound.ts` | Pipeline único; reusa `firePostInboundAutomations` |

### 4.4 Webhook oficial (Fase 5, ainda não criado)

| Caminho previsto | Função |
| --- | --- |
| `src/app/api/chat/webhook/official/route.ts` | GET verify (`hub.challenge`) + POST com HMAC + delegate ao pipeline canônico |

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
| **3** | ⬜ Pendente | Extrair persistência inbound do `route.ts` (1298 linhas) para `persistCanonicalInbound`. Uazapi passa a usar o caminho canônico | Webhook Uazapi de prod roda 100% pelo caminho canônico, comportamento idêntico |
| **4** | ⬜ Pendente | Schema (`WhatsAppInstance.provider` + credenciais Meta cifradas) + UI de seleção de provider pelo cliente. Migração aditiva via `pnpm db:migrate` + ritual pós-migration | Cliente grava credenciais Meta cifradas, provider visível no banco, sem afetar envio/recebimento |
| **5** | ⬜ Pendente | `src/app/api/chat/webhook/official/route.ts` (GET verify + POST HMAC) reusando `persistCanonicalInbound` | Mensagem real do número Meta cria Lead/Conversation/Message e dispara automações idênticas ao Uazapi |
| **6** | ⬜ Pendente | `router/message/*` resolve provider via factory por-tracking. Uazapi e Oficial coexistem; default Uazapi | Dois trackings em paralelo, um por provider, sem regressão |

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
| Reusar `firePostInboundAutomations` (Fase 3) | Evita duplicar as 1298 linhas do `route.ts`; ambos os providers convergem no mesmo pipeline pós-inbound. |
| Onde guardar credenciais Meta — decidir na Fase 4 | Decisão postergada; estender `WhatsAppInstance` é o caminho mais provável (1:1 com tracking, sem JOIN novo). |

---

## 8. Riscos & Armadilhas

| Risco | Mitigação |
| --- | --- |
| Janela de 24h da Meta (texto livre só dentro dela) | `OfficialProvider.sendText` (Fase 2) detecta erros `131047`/`131051` e devolve erro semântico; PORT reservará espaço para `sendTemplate`. |
| Detecção de ban Uazapi-only | No caminho Official, `429`/token expirado **não** acionam `markInstanceConnectionFailure` (semântica distinta). |
| `x-hub-signature-256` é sobre RAW body | Handler (Fase 5) deve ler `request.text()` antes de qualquer parse; já refletido em `verify-signature.ts`. |
| URL lookaside expira (~5 min) | Sempre baixar mídia inbound na hora e subir no R2 — nunca persistir a URL crua. |
| Templates obrigatórios (HSM) na Meta | Decisão de produto na Fase 6: trackings `OFFICIAL` precisam de pelo menos um template "abertura". |
| Access token / App Secret | Cifrados via `@/lib/crypto` + `AI_SECRETS_KEY` no banco (Fase 4); nunca logar (usar `last4`). Na Fase 1 vivem em env local. |
| `fromMe` / eco | Meta **não** ecoa via webhook as mensagens que você enviou (diferente da Uazapi). `Message{fromMe:true}` no Official vem só do caminho outbound. |
| Verify token compartilhado entre múltiplos trackings | `WhatsAppInstance.metaVerifyToken` por instância cobre o caso (Fase 4). |

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
| 2026-06-08 | **Fase 2 concluída.** PORT `WhatsAppChatProvider` + tipos canônicos (`types.ts`), factory aberta a N providers via registry (`factory.ts`), adapters `UazapiProvider` e `OfficialProvider` (cobrindo send + normalizeInbound + verifyWebhook), e `index.ts` com side-effect imports que auto-registram os adapters. Typecheck do projeto inteiro: exit 0. Único diretório alterado: `src/features/tracking-chat/lib/providers/`. Chat Uazapi: intocado — `router/message/*` e `route.ts` continuam falando Uazapi direto até a Fase 6. Branch: `feature/tracking-chat-whatsapp-oficial-port-adapters-20260608`. |
| 2026-06-08 | **Fase 1 validada ponta-a-ponta.** Envio real no sandbox Meta retornou `wamid` e mensagem chegou no WhatsApp. HMAC self-check (3/3) e parse de fixtures (7/7) verdes. Typecheck do projeto inteiro: exit 0. Chat Uazapi: intocado. |
| 2026-06-08 | **Fase 1 implementada.** Clients HTTP crus em `src/http/whats-oficial/`: `client.ts`, `send-{text,media,location,contact}.ts`, `upload-media.ts`, `get-media.ts`, `webhook-schema.ts` (Zod), `verify-signature.ts` (HMAC + `timingSafeEqual`), `types.ts`, `index.ts` (barrel re-export — substitui o esboço SOLID original), `playground/send-test.ts` (tsx). |
| 2026-06-08 | **Fase 1 iniciada.** Plano aprovado. Branch `feature/tracking-chat-whatsapp-oficial-clients-meta-20260608`. Documento vivo criado. CLAUDE.md item 13 grava a regra de manter este documento atualizado. |
