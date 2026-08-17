---
id: 0003
titulo: Baseline do Tracking Chat — contrato do domínio
dominio: tracking-chat
status: implementada
autor: João Gabriel
criada: 2026-08-17
atualizada: 2026-08-17
branch: feature/tracking-chat-spec-baseline-20260817
pr:
peso: completa
---

# 0003 — Baseline do Tracking Chat

> **Esta spec é diferente das outras.** Ela não descreve uma mudança: descreve
> o **estado atual** do domínio `tracking-chat` e os **invariantes** que
> qualquer mudança futura precisa respeitar.
>
> **Como usar**: antes de mexer no chat, leia as seções 3 (mapa), 5 (casos de
> borda) e 6 (invariantes). Ao propor uma mudança, escreva uma spec nova
> (`0004`, `0005`, …) que **cite** esta pelo número e registre no changelog
> daqui o que passou a divergir. Esta spec é atualizada, não substituída.

---

## 1. Contexto

O `tracking-chat` é o app de atendimento da NASA: 119 arquivos em
`src/features/tracking-chat/`, mais 31 handlers oRPC em `src/app/router/` e
3 endpoints de webhook. É o domínio com mais superfície de integração do
projeto — dois providers de WhatsApp, um canal próprio (In-Chat), Instagram,
Facebook, IA, automações, Stars, alertas e realtime.

Nada disso está documentado num lugar só. O que existe hoje:

- [`docs/whatsapp-oficial-overview.md`](../../docs/whatsapp-oficial-overview.md)
  — cobre **só** a Meta Cloud API (fases 1–10, contrato Graph, env vars).
- Comentários de topo de arquivo — bons, mas espalhados; ninguém lê os 119.

O custo disso já apareceu: o próprio código registra correções que existem
porque um caminho não foi enumerado antes — o gap de paridade do In-Chat
(`incoming-message-pipeline.ts`, PR #71: o endpoint público salvava a mensagem
mas não disparava IA/workflow/round-robin), o "Fix #2" do charge de Stars antes
do resolve de provider (`router/message/create.ts:77-92`), e o sticker que
duplicava porque a Meta reentrega em 5xx e o persist usava `create` em vez de
`upsert` (`persist-canonical-inbound.ts:608-624`).

Os três são o mesmo tipo de bug: **um caminho condicional sobre dados de
produção que ninguém listou antes de escrever o código** — exatamente o que a
[spec 0001](../form/0001-form-submit-lead-placement.md) motivou evitar.

## 2. Objetivo

Quem for alterar o chat consegue, em uma leitura, saber **por onde a mensagem
passa**, **quais invariantes não pode quebrar** e **quais casos de borda já
custaram bug** — sem precisar ler os 119 arquivos.

### Não-objetivos

- **Não** documenta a Meta Cloud API em detalhe — isso é o
  `docs/whatsapp-oficial-overview.md` (item 14 do CLAUDE.md). Aqui só o
  contrato da PORT.
- **Não** propõe refactor. Divergências arquiteturais estão registradas na
  seção 7 como dívida conhecida, não como plano.
- **Não** cobre `src/features/astro/` (copilot), `stars`, `workflows` ou
  `alerts` — só o ponto onde o chat os aciona.
- **Não** cobre a página pública `/whatsapp/[orgSlug]` (In-Chat visto pelo
  lead) além da parte que o chat enxerga.

## 3. Mapa do domínio

### 3.1 Onde mora o quê

| Camada | Caminho | Nota |
| --- | --- | --- |
| UI | `src/features/tracking-chat/components/` (69 arquivos) | Maiores: `footer-chat.tsx` (939), `budget-panel.tsx` (880), `message-box.tsx` (589), `body.tsx` (558) |
| Hooks | `src/features/tracking-chat/hooks/` (13) | `use-messages.ts` (986) concentra todas as mutations de envio |
| Estado global | `src/features/tracking-chat/context/use-message.ts` | Zustand: `instanceId`/`status` + estado de edição |
| Domínio server | `src/features/tracking-chat/lib/` | PORT/adapters, pipeline inbound, In-Chat, forward strategies |
| **Procedures oRPC** | `src/app/router/message/` (19) + `src/app/router/conversation/` (12) | **Fora** da feature — ver dívida D-1 |
| Webhooks | `src/app/api/chat/webhook/route.ts` (762), `.../webhook/official/route.ts` (540), `src/app/api/in-chat/[slug]/` | 3 portas de entrada |
| Páginas | `src/app/(platform)/(tracking)/tracking-chat/` | `layout.tsx` (lista + resizable), `[conversationId]/page.tsx` (header/body/footer) |
| Schema | `prisma/schema.prisma` | `Conversation`, `Message`, `WhatsAppInstance`, `UserSticker` |

### 3.2 Modelos e chaves que importam

| Campo | Papel | Armadilha |
| --- | --- | --- |
| `Message.messageId` | ID **externo** (`wamid…` Meta, `messageid` Uazapi, `uuidv4()` In-Chat). `@unique` **global** | É a chave de idempotência de todo `upsert` inbound. String vazia aqui colide na próxima entrega — há guard explícito |
| `Message.status` | Enum `SENT/DELIVERED/SEEN/FAILED/DELETED` | Controla os **ticks**. `PENDING` existe só no client (`types.ts`), não no banco |
| `Message.seen` | Boolean separado | Controla o **badge de não-lidas** (`_count` em `conversation/list.ts:99-105`). Inbound nasce com `status: SEEN` e `seen: false` — **não são a mesma coisa** |
| `Message.viaInChat` | Mensagem trafegou pelo widget público, não pelo WhatsApp | Também é sinal de detecção: qualquer mensagem `viaInChat` na conversa faz o envio pular a Uazapi para sempre |
| `Conversation.leadId` | `@unique` + `@@unique([leadId, trackingId])` | **1 conversa por lead**. Não existe multi-thread por lead |
| `Conversation.firstUserMessageAt` | Guarda do gatilho `FIRST_CHAT_INTERACTION` | Atomicidade via `updateMany` condicional (`router/message/utils.ts:151-160`) — não trocar por `findFirst` + `update` |
| `Lead.phone` + `@@unique([phone, trackingId])` | Lookup do inbound | Mesmo telefone em trackings diferentes = leads diferentes |
| `WhatsAppInstance.trackingId` | `@unique` | **1 instância por tracking**. Toda resolução de provider parte daqui |

### 3.3 Fluxo inbound (mensagem chega)

```
┌─ webhook Uazapi ─────┐
│ /api/chat/webhook    │──┐
└──────────────────────┘  │
┌─ webhook Meta ───────┐  │   normalizeInbound()      persistCanonicalInbound()
│ .../webhook/official │──┼──► (adapter, provider- ──► (pipeline, provider- ──► firePostInbound
└──────────────────────┘  │     specific)                 AGNÓSTICA)              Automations()
┌─ In-Chat ────────────┐  │
│ /api/in-chat/[slug]  │──┘
└──────────────────────┘
```

**`persistCanonicalInbound`** (`lib/inbound/persist-canonical-inbound.ts`) faz,
nesta ordem: contexto do tracking (cache 30s) → guard de `externalMessageId`
vazio → revoke → skip de `reaction`/`unsupported` → lead lookup/criação →
conversation → quoted/edited lookup → persist por tipo → dispatch do agente IA
→ automações.

**`firePostInboundAutomations`** (`lib/incoming-message-pipeline.ts`) faz, cada
etapa em `try/catch` isolado: timestamps → `trackLeadEvent` → alert engine →
Inngest IA → automação de ociosidade → primeira interação do dia → Pusher.

Tudo que é provider-specific entra por **strategy injetada**:
`fetchProfilePicture`, `downloadInboundMedia`, `ctwaSources`.

### 3.4 Fluxo outbound (atendente envia)

`use-messages.ts` (optimistic update) → `orpc.message.create*` →
`router/message/create*.ts`:

1. Carrega `Conversation` (channel, trackingId, organizationId).
2. `shouldSkipUazapiForConversation()` — decide In-Chat.
3. **`resolveOutboundProvider(trackingId)` ANTES do charge** — cache 30s.
4. `chargeMessageOutbound()` — 1★.
5. Dispatch: IG / FB / In-Chat (no-op) / `provider.send*()`.
6. `prisma.message.create` → Pusher `message:created`.
7. Efeitos: `attendLeadIfWaiting`, `updateConversationLastMessage`,
   `claimLeadForAttendant`, `triggerFirstChatInteractionIfFirst`,
   `logChatMessageSent`.

### 3.5 Realtime — eventos e canais

| Evento | Canal | Emissor | Consumidor |
| --- | --- | --- | --- |
| `message:new` | `conversationId` **e** `trackingId` | `firePostInboundAutomations` | `body.tsx`, `use-conversation.ts` |
| `message:created` | `conversationId` | procedures de envio | `body.tsx` (ignora se `currentUserId` é o próprio) |
| `message:updated` | `conversationId` | revoke / delete | `body.tsx` (patch in-place) |
| `conversation:new` | `trackingId` | pipeline inbound | `use-conversation.ts` |
| `lead:updated` | `trackingId` | `claimLeadForAttendant` | `use-conversation.ts` |
| `inchat:status-changed` | `trackingId` | `lib/in-chat-mode.ts` | badge/banner In-Chat |
| `lead-changed` | `boardLeadsChannelName(trackingId)` | board de leads | `use-tracking-chat-realtime-sync.ts` (só campo `tag`) |

**Dois sistemas de realtime convivem**: `pusherClient.bind` direto (body,
use-conversation) e `useRealtimeChannel` (sync de tags). Não unifique num
PR de outra coisa.

### 3.6 Query keys do React Query

Chaves **escritas à mão**, não geradas pelo oRPC — por isso frágeis:

| Key | Onde |
| --- | --- |
| `["message.list", conversationId]` | `body.tsx`, todas as mutations de `use-messages.ts` |
| `["conversations.list", trackingId, statusId, search, statusFlow, channel, tagIds, favoritesOnly]` | `use-conversation.ts:34-43` — **8 posições**, reconstruída manualmente no handler de realtime |
| `["conversations.list.forward", trackingId, search]` | `useConversationListInfinite` (dialog de encaminhar) |

## 4. Critérios de aceite (regressão)

Checklist mínimo para qualquer PR que toque o chat. Não há runner de testes no
projeto — **verificação é manual** (ver seção 8).

- [ ] **CA-1** — Enviar texto para lead WhatsApp: bolha otimista aparece
      imediata (1 tick), vira `SENT` (2 ticks) ao voltar do servidor, e a
      conversa sobe ao topo da lista.
- [ ] **CA-2** — Receber mensagem com o chat aberto: aparece sem refresh, sem
      duplicar, e o `unreadCount` **não** incrementa na conversa aberta.
- [ ] **CA-3** — Receber mensagem com o chat fechado: `unreadCount` incrementa
      e a conversa sobe ao topo.
- [ ] **CA-4** — Lead `FINISHED` volta a falar: `statusFlow` vira `ACTIVE` no
      backend **e** o card sai do filtro "Finalizados" sem refresh.
- [ ] **CA-5** — Reentrega do mesmo webhook (mesmo `externalMessageId`): nenhuma
      mensagem duplicada, para texto, mídia, áudio e sticker.
- [ ] **CA-6** — Falha de envio: bolha otimista some (rollback) e o toast de
      erro aparece; nenhuma ★ cobrada quando o resolve de provider falha.
- [ ] **CA-7** — Scroll infinito para cima preserva a posição visual (não
      pula) e não dispara fetch duplo.
- [ ] **CA-8** — Tracking em `META_CLOUD` fora da janela de 24h: composer
      bloqueado com o `TemplatePicker` como única saída.

## 5. Casos de borda já conhecidos

**Esta é a seção que economiza PR.** Cada linha existe porque o código a trata
explicitamente — se sua mudança altera alguma, ela vira caso de aceite da spec
nova.

### 5.1 Inbound

| # | Caso | Comportamento atual | Onde |
| --- | --- | --- | --- |
| CB-1 | `externalMessageId` vazio | Skip com warn — **não** grava | `persist-canonical-inbound.ts:147-158` |
| CB-2 | `reaction` inbound | **Skip silencioso — reações não são persistidas** | `:166-168` |
| CB-3 | `unsupported` (tipo novo do provider) | Skip com `providerType` no retorno | `:169-171` |
| CB-4 | Revoke de mensagem que não está no banco | Skip silencioso, sem log | `:346-352` |
| CB-5 | Revoke normal | `status: DELETED` + limpa body/mídia + Pusher `message:updated` | `:324-345` |
| CB-6 | Lead existe mas sem `Conversation` | Cria conversa e **recarrega** o lead | `:196-217` |
| CB-7 | Lead `FINISHED` + inbound | Reativa para `ACTIVE` | `:219-228` |
| CB-8 | Tracking sem nenhum `Status` | `createLeadFromInbound` devolve `null` → `lead_creation_failed` | `:383-388` |
| CB-9 | Edição de mensagem | `upsert` na chave **antiga** (`editedTargetMessageId`); mídia **não** re-baixa | `:550, :597` |
| CB-10 | Áudio reentregue | `update: {}` — preserva `status`/`body`/`createdAt` | `:631-638` |
| CB-11 | Sticker reentregue | `upsert` idempotente (Meta reentrega em qualquer 5xx) | `:608-624` |
| CB-12 | Contato sem nome **e** sem telefone | Retorna `null`, não persiste | `:684` |
| CB-13 | Download de mídia falha | Persiste **sem** `mediaUrl` (mantém messageId/mimetype/caption para debug) | `:596-603` |
| CB-14 | Webhook Uazapi chega em tracking `META_CLOUD` | Ignorado — evita duplicata pós-migração | `get-cached-tracking-context.ts:27-33` |
| CB-15 | `senderName` ausente | Fallback literal `"Sem nome"` — **a UI renderiza isso** | `:528` |

### 5.2 Outbound

| # | Caso | Comportamento atual | Onde |
| --- | --- | --- | --- |
| CB-16 | Lead com `source: IN_CHAT` | **Nunca** tenta Uazapi (não tem WhatsApp real) | `in-chat-mode.ts:102, :112` |
| CB-17 | Conversa com qualquer msg `viaInChat` | Idem — skip permanente da Uazapi | `in-chat-mode.ts:104-113` |
| CB-18 | Modo In-Chat **manual** (toggle do owner) | **NÃO** pula a Uazapi — WhatsApp segue normal | `in-chat-mode.ts:73-84` |
| CB-19 | 3 falhas consecutivas de envio/conexão | Ativa In-Chat automático + `logActivity` + Pusher | `in-chat-mode.ts:39, :203-241` |
| CB-20 | Erro `401/403/500/invalid token/timeout` (Uazapi) | Conta como falha de ban | `router/message/create.ts:170-182` |
| CB-21 | `session is not reconnectable` / 503 | Erro tipado `WHATSAPP_DISCONNECTED` com instrução de reconectar | `create.ts:183-197` |
| CB-22 | Instância Uazapi sem `apiKey`/`baseUrl` | `requireUazapiToken/BaseUrl` lança — estado corrompido, erro claro | `resolve-outbound-provider.ts:156-157` |
| CB-23 | Meta sem `appSecret` (Embedded Signup grava NULL) | Aceito — outbound não usa; webhook cai no env global | `resolve-outbound-provider.ts:117-144` |
| CB-24 | Provider ou credencial trocada na UI | Cache de 30s **precisa** de `invalidateOutboundProvider(trackingId)` | `resolve-outbound-provider.ts:178-180` |
| CB-25 | `sendTemplate` num tracking Uazapi | Lança `ProviderFeatureUnsupportedError` | `providers/types.ts:329-333` |
| CB-26 | `markPreviousAsRead` | Default `true` (tick azul do lead). Meta ignora; Uazapi mapeia para `readmessages`/`readchat` | `providers/types.ts:200-217` |

### 5.3 Cliente / realtime

| # | Caso | Comportamento atual | Onde |
| --- | --- | --- | --- |
| CB-27 | Pusher ecoa a mensagem que **eu** acabei de enviar | `body.tsx` descarta quando `currentUserId === session.user.id` | `body.tsx:355-361` |
| CB-28 | `message:new` chega nos dois canais (conversa + tracking) | Dedupe por `msg.id` já presente no cache | `body.tsx:289-310` |
| CB-29 | Mensagem chega numa conversa **fora** da página atual do cache | `found = false` → `invalidateQueries` da lista | `use-conversation.ts:129-131` |
| CB-30 | Usuário rolou para cima e chega mensagem nova | Não força scroll; mostra botão "descer" | `body.tsx:231-256` |
| CB-31 | Beep de mensagem recebida | Só para `fromMe === false` **e** `viaInChat === true` (WhatsApp normal não beepa) | `body.tsx:362-372` |
| CB-32 | Filtro novo adicionado à lista de conversas | A `queryKey` de 8 posições precisa mudar **nos dois lugares** ou o realtime deixa de casar | `use-conversation.ts:34-43` |
| CB-33 | Busca ativa na lista | Leads **arquivados** voltam a aparecer (com badge) — filtro de arquivado é suspenso | `conversation/list.ts:51-55` |

## 6. Invariantes (regras para mudar o chat)

### I-1 — Mudança pós-inbound entra em `firePostInboundAutomations`

Nunca replique no webhook. Os 3 endpoints (Uazapi, Meta, In-Chat) chamam o
mesmo helper justamente porque o In-Chat já ficou sem IA/workflow/round-robin
por copy-paste divergente (PR #71).

### I-2 — `persistCanonicalInbound` não conhece provider

Precisa de I/O específico? Injete uma **strategy** no
`PersistCanonicalInboundContext`. Nenhum `if (providerId === …)` dentro do
pipeline.

### I-3 — Tipo de mensagem novo toca 5 lugares

Union canônica (`providers/types.ts`) → `normalizeInbound` de **cada** adapter
→ `persist<Tipo>` → render (`message-box.tsx` + `*-message-box.tsx`) → preview
na lista (`lead-box.tsx`). Faltou um: a mensagem chega e some.

### I-4 — Idempotência é `upsert` por `messageId`

A Meta reentrega agressivamente em qualquer 5xx. Persistência inbound nova usa
`upsert`, nunca `create`.

### I-5 — Resolve de provider antes de cobrar ★

`resolveOutboundProvider` pode lançar. Cobrar antes = cliente paga por
mensagem que não saiu, sem refund.

### I-6 — Credencial não volta para o client

O token Uazapi saiu do front (`context/use-message.ts:5-8`); o store guarda só
`instanceId`/`status`. Inputs com `token` nas procedures são `@deprecated` e
**ignorados** — não reative.

### I-7 — Chamada oRPC nova vai em hook

CLAUDE.md item 9. Hoje **19 componentes** chamam `orpc.*` direto (dívida D-2).
Não é permitido aumentar essa lista.

### I-8 — Nada de I/O nem cliente global dentro de `$transaction`

CLAUDE.md item 18. No chat isso aparece em `assignLeadRoundRobin`, que roda
dentro de `prisma.$transaction((tx) => …)` recebendo o `tx` corretamente —
mantenha o padrão.

### I-9 — Efeito colateral pós-envio é best-effort

Falha em Pusher, `logActivity` ou `trackLeadEvent` **não** pode derrubar um
envio já persistido. Todo efeito novo entra em `try/catch` isolado.

### I-10 — `status` e `seen` são coisas diferentes

`status` = ticks. `seen` = badge de não-lidas. Inbound nasce `status: SEEN`,
`seen: false`. Mexer em um sem o outro quebra silenciosamente o contador.

## 7. Dívida conhecida (registro, não plano)

### D-1 — Procedures fora da feature

`src/app/router/message/` e `.../conversation/` deveriam estar em
`src/features/tracking-chat/server/` pela arquitetura por features do
CLAUDE.md. Estão fora por herança. **Decisão**: manter onde estão; mover é um
PR próprio, com spec própria, não carona.

### D-2 — 19 componentes chamam `orpc` direto

`budget-panel` (8 chamadas), `emoji-sticker-picker` (5),
`unified-history-view` (4), entre outros. Regra do I-7: não aumentar.
Migrar o que tocar (boy-scout), sem PR gigante de rename.

### D-3 — `budget-panel.tsx` é código morto

880 linhas substituídas por `proposals-and-budgets/`. O footer só usa o novo
(`footer-chat.tsx:64-68`). Candidato a remoção — ver preferência registrada de
desativar antes de deletar.

### D-4 — Nome legado do evento Inngest

`chat/ai.whatsapp-message-received` serve também In-Chat/IG/FB; o canal real
vai em `data.channel`. Renomear exige mexer no listener
(`src/inngest/functions/chat-ai-respond.ts`).

### D-5 — `painel.tsx` é placeholder

Select hard-coded com "Cliente 1/2/3" e `onValueChange` vazio.

### D-6 — `message.list` engole o erro real

`catch` genérico devolve `INTERNAL_SERVER_ERROR` sem log
(`router/message/list.ts:87-89`), o que dificulta diagnosticar 500 na abertura
da conversa.

## 8. Plano de testes

**Não há runner de testes no projeto** (sem vitest/jest). Até existir, todo
`CA-n` é verificado manualmente e o PR descreve o passo executado.

| Critério | Como verificar |
| --- | --- |
| CA-1, CA-6 | Enviar texto num tracking Uazapi conectado; para CA-6, derrubar a instância e repetir |
| CA-2, CA-3 | Mandar do celular com a conversa aberta e depois fechada |
| CA-4 | Finalizar o lead, mandar mensagem do celular, observar a lista |
| CA-5 | Reenviar o mesmo payload de webhook via `curl` (mesmo `id`) — texto, imagem, áudio e sticker |
| CA-7 | Conversa com 100+ mensagens: rolar até o topo |
| CA-8 | Tracking `META_CLOUD` com última inbound > 24h |

Quando adicionarmos runner: cada `CA-n` vira teste citando o id no nome, como
manda o [`specs/README.md`](../README.md).

## 9. Riscos e rollback

| Risco | Sinal | Mitigação |
| --- | --- | --- |
| Mensagem duplicada na conversa | Bolha repetida após reentrega | `upsert` por `messageId` (I-4); conferir antes de trocar por `create` |
| Mensagem some ao enviar | Envio "ok" mas nada no banco | Tentativa de Uazapi para lead In-Chat — checar CB-16/CB-17 |
| Lista de conversas para de atualizar em tempo real | Só atualiza no F5 | `queryKey` de 8 posições dessincronizada (CB-32) |
| ★ cobrada sem envio | Saldo cai, lead não recebe | I-5 |
| Chat abre com 500 | Conversa em branco | `message.list` engole o erro (D-6) — logar antes de investigar |
| Credencial trocada não surte efeito por 30s | Envio ainda no provider antigo | `invalidateOutboundProvider` (CB-24) |

**Rollback**: alterações neste domínio não têm migration própria. Reverter o
merge basta, **exceto** quando a mudança tocar `WhatsAppInstance` ou `Message`
— aí a spec da mudança declara a reversibilidade da migration.

## 10. Referências

- [`docs/whatsapp-oficial-overview.md`](../../docs/whatsapp-oficial-overview.md)
  — Meta Cloud API (obrigatório atualizar junto, CLAUDE.md item 14)
- [`specs/0001`](../form/0001-form-submit-lead-placement.md) — o caso que
  motivou o SDD
- [`CLAUDE.md`](../../CLAUDE.md) — itens 9 (hooks), 12 (nomes), 13
  (comentários/tipagem), 14 (docs WhatsApp), 17 (SDD), 18 (`$transaction`)

## 11. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-08-17 | João Gabriel | Criada — baseline do domínio a partir da leitura de `src/features/tracking-chat/`, `src/app/router/{message,conversation}/` e webhooks |
| 2026-08-17 | João Gabriel | Divergências da [spec 0004](0004-video-por-script.md): (a) **5º sender outbound** — `message.createWithVideo` emitindo `mediaKind: "video"`; §3.4 e I-3 valem para ele. (b) **Render de `video/*`** passou a existir (`video-message-box.tsx`); antes nenhuma branch do `message-box` cobria vídeo e a bolha saía vazia. (c) **Bolha em mídia** — `isFile` deixou de zerar fundo/rabinho; toda mídia agora mantém a bolha com moldura de 3px. (d) Novo `CB`: script com vídeo envia direto em vez de preencher o composer |
