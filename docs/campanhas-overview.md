# App "Campanhas" (Disparos WhatsApp API Oficial) — Planejamento

> Documento de planejamento do novo app de **campanhas de disparo em massa** via **API Oficial do WhatsApp (Meta Cloud API)**. Status: **Fases 1 + 2 + 3 implementadas (2026-07-08); Fase 4 (Agendamento) implementada (2026-07-09).** Criado em 2026-07-07.
>
> Base da integração Oficial já existente: ver [`docs/whatsapp-oficial-overview.md`](whatsapp-oficial-overview.md).

---

## 1. Contexto

A NASA já tem toda a plumbing da **API Oficial do WhatsApp (Meta Cloud API)** madura (Fases 1–10 do `whatsapp-oficial-overview.md`): clients HTTP, PORT/adapters, credenciais cifradas por-tracking, envio de template (`sendTemplate`), listagem de templates, webhook oficial e analytics. O que **falta** é um app de **campanhas de disparo em massa** (marketing) que use essa base para: montar audiência, criar/disparar templates e gerenciar fundos — com segurança (API oficial evita ban de número).

O app é entregue em **fases**. A **Fase 1 é fundacional** (decisão do dono: "temos poucas informações, vamos ter cautela e já fazer uma arquitetura sólida"): cria o esqueleto do app, o **modelo de dados extensível** e a **montagem de audiência** (reaproveitando leads do tracking + upload CSV). Criação de template, disparo em massa, agendamento e gestão de fundos vêm em fases seguintes, encaixando na arquitetura desenhada aqui — algumas dependem de docs adicionais da Meta que o dono vai enviar.

## 2. Decisões travadas (Q&A com o dono)

| Decisão | Escolha |
| --- | --- |
| Localização | **App próprio na sidebar** ("Campanhas"), não aba do tracking. Dentro dele seleciona-se o número Oficial (tracking `META_CLOUD`) de origem. |
| Endpoint de envio | **`/marketing_messages` (MM API)** — otimização de entrega + métricas; só templates de marketing aprovados; `product_policy: CLOUD_API_FALLBACK`. |
| Fundos/saldo | **Adiado pra fase própria.** Dono enviará docs da API de billing/credit-line. (Meta provavelmente não expõe "adicionar saldo" via API — a fase vai focar em ler saldo + alertar.) |
| Escopo Fase 1 | **Arquitetura sólida + audiência** (leads do tracking + upload CSV). Sem criação de template nem disparo ao vivo ainda. |

> **Nomenclatura:** o nome do produto é **"Campanhas"** e o domínio interno chama-se **`campanhas`** (feature `src/features/campanhas/`, router key `campanhas`, rota `/campanhas`, sidebar "Campanhas"). Já existe `campaigns` (inglês) no `nasa-planner`/`meta-ads`/`insights`, mas sempre como **chave aninhada** sob outros routers — `campanhas` (português, top-level) não colide. Modelos Prisma em inglês: `Broadcast` / `BroadcastRecipient`.

## 3. Arquitetura alvo (visão completa, todas as fases)

```
Sidebar "Campanhas" → /campanhas (app próprio, dentro do (tracking) layout)
  │
  ├─ Selecionar número de origem  → trackings com WhatsAppInstance.provider = META_CLOUD
  ├─ Montar audiência             → leads do tracking (filtros) | CSV/XLSX
  ├─ Escolher/criar template      → integrations.listWhatsAppTemplates (existe) + criação (Fase 2)
  ├─ Disparar / agendar           → Inngest (throttle) via resolveOutboundProvider (Fase 3/4)
  └─ Saldo / fundos               → API billing Meta (Fase 5, pós-docs)

Envio (Fase 3): campanhas.send → Inngest `campanhas/broadcast.send`
  handler (concurrency + throttle por organizationId):
    lê BroadcastRecipient PENDING em lotes
    → resolveOutboundProvider(trackingId)        [REUSO — já existe]
    → provider.sendMarketing(...) via /marketing_messages
    → grava wamid + status no recipient + counters + Stars

Status (Fase 3): webhook oficial (/api/chat/webhook/official) já roda applyStatusUpdates
  → estender pra também casar wamid → BroadcastRecipient (sent/delivered/read/failed)
```

## 4. Modelo de dados (Prisma) — núcleo da "arquitetura sólida"

Adicionar em `prisma/schema.prisma` (migration via `pnpm db:migrate` — **nunca** `db push`):

```prisma
enum BroadcastStatus {
  DRAFT SCHEDULED SENDING SENT PAUSED FAILED CANCELLED
}

enum BroadcastRecipientStatus {
  PENDING QUEUED SENT DELIVERED READ FAILED SKIPPED
}

model Broadcast {
  id             String @id @default(cuid())
  name           String
  organizationId String @map("organization_id")
  trackingId     String @map("tracking_id")      // número/instância META_CLOUD de origem
  createdById    String @map("created_by_id")
  status         BroadcastStatus @default(DRAFT)

  // Template (preenchido na Fase 2/3 — nullable na Fase 1)
  templateName      String? @map("template_name")
  templateLanguage  String? @map("template_language")
  templateVariables Json?   @map("template_variables")  // config de mapeamento var→campo

  // Agendamento (Fase 4 — colunas já existem, cautela)
  scheduledAt DateTime? @map("scheduled_at")
  startedAt   DateTime? @map("started_at")
  completedAt DateTime? @map("completed_at")

  // Contadores denormalizados p/ UI (sem COUNT scans; alimentados pelo webhook de status)
  totalRecipients Int @default(0) @map("total_recipients")
  sentCount       Int @default(0) @map("sent_count")
  deliveredCount  Int @default(0) @map("delivered_count")
  readCount       Int @default(0) @map("read_count")
  failedCount     Int @default(0) @map("failed_count")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  tracking     Tracking     @relation(fields: [trackingId], references: [id], onDelete: Cascade)
  createdBy    User         @relation(fields: [createdById], references: [id])
  recipients   BroadcastRecipient[]

  @@index([organizationId]) @@index([trackingId]) @@index([status])
  @@map("broadcasts")
}

model BroadcastRecipient {
  id          String @id @default(cuid())
  broadcastId String @map("broadcast_id")
  leadId      String? @map("lead_id")   // null quando origem é CSV cru
  name        String?
  phone       String                    // E.164 só-dígitos (normalizePhone)
  variables   Json?                     // valores das variáveis do template p/ este destinatário
  status      BroadcastRecipientStatus @default(PENDING)
  externalMessageId String? @map("external_message_id") // wamid
  errorCode    String?  @map("error_code")
  errorMessage String?  @map("error_message")
  sentAt      DateTime? @map("sent_at")
  deliveredAt DateTime? @map("delivered_at")
  readAt      DateTime? @map("read_at")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  broadcast Broadcast @relation(fields: [broadcastId], references: [id], onDelete: Cascade)
  lead      Lead?     @relation(fields: [leadId], references: [id], onDelete: SetNull)

  @@unique([broadcastId, phone])          // dedupe dentro da campanha
  @@index([broadcastId, status]) @@index([externalMessageId])
  @@map("broadcast_recipients")
}
```

Adicionar as relações inversas em `Organization` (`broadcasts Broadcast[]`), `Tracking` (`broadcasts Broadcast[]`), `User` (`broadcasts Broadcast[]`), `Lead` (`broadcastRecipients BroadcastRecipient[]`).

**Pós-migration (CLAUDE.md item 11, OBRIGATÓRIO):** `pnpm db:generate` → bumpar `SCHEMA_VERSION` em `src/lib/prisma.ts` → `touch` nos catch-all (`api/auth/[...all]`, `api/rpc/[[...rest]]`) → validar rota com `curl`.

## 5. Fase 1 — o que construir

### 5.1 Domínio oRPC `src/app/router/campanhas/` (um arquivo por procedure)
Todas com `base.use(requiredAuthMiddleware).use(requireOrgMiddleware)`, org via `context.org.id` / `context.session.activeOrganizationId`, `logActivity`, tenancy gate (participação no tracking + `WhatsAppInstance.organizationId === org.id`). Registrar `campanhas: campanhasRouter` em `src/app/router/index.ts`.

- `list-sending-numbers.ts` → lista trackings da org com `WhatsAppInstance.provider = META_CLOUD` (id, nome, `phoneNumber`/`profileName`). Alimenta o seletor de origem.
- `create.ts` → cria `Broadcast` DRAFT `{ name, trackingId }` (valida que o tracking tem instância `META_CLOUD`).
- `list.ts` / `get.ts` / `update.ts` / `delete.ts` → CRUD do broadcast (get inclui contadores + amostra de recipients).
- `add-recipients-from-leads.ts` → `{ broadcastId, filtros }` → resolve leads do tracking do broadcast (espelha o vocabulário de filtros de `leads.listLeadsByStatus`: status, tags, temperatura, `actionFilter`), normaliza phone, dedupe `(broadcastId, phone)`, `createMany({ skipDuplicates:true })`, atualiza `totalRecipients`.
- `add-recipients-from-csv.ts` → `{ broadcastId, rows }` (linhas já parseadas no client) → normaliza/dedupe/insere igual acima (`leadId: null`).
- `list-recipients.ts` (paginada) / `remove-recipient.ts`.

### 5.2 Feature `src/features/campanhas/`
- `hooks/use-broadcasts.ts` → `useBroadcasts`, `useBroadcast`, `useCreateBroadcast`, `useUpdateBroadcast`, `useDeleteBroadcast` (mutations com invalidação default; toasts no componente). `hooks/use-broadcast-audience.ts` → `useAddRecipientsFromLeads`, `useAddRecipientsFromCsv`, `useBroadcastRecipients`, `useRemoveRecipient`. `hooks/use-sending-numbers.ts`.
- `schema/` → zods de input (broadcast, filtros de audiência, linhas CSV).
- `components/` → `broadcasts-list.tsx` (lista + botão criar), `create-broadcast-dialog.tsx` (nome + seletor de número Oficial), `broadcast-detail.tsx` (cabeçalho + contadores + abas), `audience-builder/` (aba "Leads" com filtros reaproveitando componentes de filtro de trackings; aba "CSV" reusando o parser de contatos), `recipients-table.tsx`.
- `lib/` → serviço de resolução de audiência a partir de filtros (query builder puro, testável).

### 5.3 App + navegação
- `src/app/(platform)/(tracking)/campanhas/page.tsx` → `<SidebarInset>` + `<BroadcastsList/>`.
- `src/app/(platform)/(tracking)/campanhas/[broadcastId]/page.tsx` → `<BroadcastDetail/>`.
- Sidebar: um item em `src/features/apps/lib/sidebar-items.ts` — `{ key: "campanhas", title: "Campanhas", url: "/campanhas", icon: Send, alwaysVisible: false, defaultVisible: false }`; opcionalmente mapping em `APP_TO_SIDEBAR_KEY`. Sem tocar em `nav-menu.tsx`.

### 5.4 Fundação HTTP do MM API (contrato travado, sem wiring ainda)
- `src/http/whats-oficial/send-marketing-message.ts` → `sendMarketingMessage(accessToken, phoneNumberId, input)` → `POST /{phone_number_id}/marketing_messages` (type `template`, `product_policy: "CLOUD_API_FALLBACK"`). Espelha `send-template.ts`. Types em `src/http/whats-oficial/types.ts`; export no barrel `index.ts`. Função pura — só chamada de fato na Fase 3.
- **Atualizar [`docs/whatsapp-oficial-overview.md`](whatsapp-oficial-overview.md)** na mesma sessão (CLAUDE.md item 14): novo arquivo em `src/http/whats-oficial/` → registrar no mapa de arquivos + changelog + nota de que abre o app de campanhas.

## 6. Escopo negativo (o que a Fase 1 NÃO faz)

Fase 1 é **fundação + audiência** e é deliberadamente **inócua do ponto de vista da Meta**: não envia nenhuma mensagem, não cria template, não cobra Stars, não agenda nada e não toca no chat Uazapi/Meta de produção. O client `send-marketing-message.ts` entra como função pura (contrato travado) mas **não é chamado** por nenhum caminho. Todo efeito colateral externo fica pras Fases 2–5. Git: branch via `/start tracking campanhas-app`; commit/PR só no `/ship`.

## 7. Reuso (não reimplementar)

| Precisa de | Reusar |
| --- | --- |
| Resolver provider/número p/ envio | `resolveOutboundProvider(trackingId)` — `src/features/tracking-chat/lib/providers/resolve-outbound-provider.ts` |
| Enviar template (Fase 3) | `provider.sendTemplate` / novo `sendMarketingMessage`; ordem em `src/app/router/message/create-template.ts` |
| Listar templates aprovados | `integrations.listWhatsAppTemplates` + `useWhatsAppTemplates` (`src/features/tracking-chat/hooks/use-whatsapp-templates.ts`) |
| Parser CSV/XLSX + mapeamento de colunas | `src/features/contacts/hooks/import-lead.tsx` (`parseFile`, `buildImportPayload`, `LEAD_FIELDS`) |
| Filtros de audiência de leads | vocabulário de `leads.listLeadsByStatus` (`src/app/router/leads/get-many.ts`) |
| Normalizar telefone | `normalizePhone` (`@/utils/format-phone`) |
| Credenciais Meta cifradas | `decryptStoredMetaCredentialsPartial` (`.../providers/meta-credentials.ts`) |
| Padrão Inngest throttle (Fase 3/4) | `concurrency`/`rateLimit` keyed em `event.data.organizationId` (ex.: `src/inngest/functions/process-user-action.ts`); cron scanner ex.: `src/inngest/functions/nasa-planner/publish-scheduled-posts.ts` |
| Status webhook (Fase 3) | `applyStatusUpdates` (`.../inbound/apply-status-updates.ts`) — estender p/ casar wamid → `BroadcastRecipient` |

## 8. Roadmap das fases seguintes (encaixam nesta arquitetura)

- **Fase 2 — Criação de templates na Meta. ✅ Implementada (2026-07-08).** Builder de modelos de **marketing + utilidade** estilo Meta/ManyChat (form à esquerda + prévia WhatsApp ao vivo à direita). Ver §12.
- **Fase 3 — Disparo ao vivo. ✅ Implementada (2026-07-08).** `campanhas.setTemplate`/`campanhas.send` → Inngest `campanhas/broadcast.send` (throttle por org, lotes duráveis, wamid/erro por destinatário, contadores recomputados), split de endpoint por categoria (marketing → `/marketing_messages`, utilidade → `/messages`) e extensão do webhook de status pra `BroadcastRecipient`. **Sem cobrança de Stars nesta fase** (adiado). Ver §13.
- **Fase 4 — Agendamento. ✅ Implementada (2026-07-09).** `campanhas.schedule`/`unschedule` gravam `scheduledAt` + status `SCHEDULED`; o cron `dispatch-due-broadcasts` (a cada minuto) reivindicação atômica → `SENDING` + evento Inngest. Ver §16.
- **Fase 5 — Fundos/saldo.** Ler saldo (billing/credit-line API), alerta de saldo baixo (Inngest cron + notificação), atalho de recarga. **Depende dos docs de billing** (a enviar).

## 9. Verificação (Fase 1)

1. **Migration:** dono roda `pnpm db:migrate` (ou autoriza no chat) → ritual pós-migration (item 11) → `curl -sI http://localhost:3000/campanhas` retorna 200/307.
2. **Typecheck:** `pnpm build`/`tsc` sem erros (aguardar `/ship`, salvo autorização).
3. **E2E manual (skill `/run` ou navegador):**
   - Sidebar mostra "Campanhas" → abre `/campanhas`.
   - Criar campanha selecionando um número `META_CLOUD` (se a org não tiver, mostrar estado vazio guiando pra Integrações).
   - Aba Leads: aplicar filtro, adicionar N destinatários; conferir dedupe e `totalRecipients`.
   - Aba CSV: subir planilha, mapear colunas, importar; conferir normalização de telefone e dedupe.
   - Remover destinatário; recarregar e confirmar persistência.
4. Confirmar `docs/whatsapp-oficial-overview.md` atualizado com o novo client MM API.

## 10. Itens abertos / docs que preciso do dono

1. **Docs de criação de template** (`POST /{waba_id}/message_templates`) — pra Fase 2.
2. **Docs de billing/credit-line/saldo da Meta** — pra Fase 5 (e pra confirmar se "adicionar saldo" é possível via API ou só via Business Manager).
3. Confirmar se a audiência de leads sai **sempre do tracking de origem** da campanha (assumido) ou pode cruzar trackings.

## 11. Base de conhecimento (MM API — resumo do material enviado pelo dono)

- **Endpoint:** `POST /{phone_number_id}/marketing_messages` — só **templates de marketing aprovados**; qualquer outro tipo dá erro.
- **`product_policy`:** `CLOUD_API_FALLBACK` (default; cai pra Cloud API se onboarding MM não estiver completo) ou `STRICT` (sem fallback).
- **`message_activity_sharing`** (opcional, por mensagem): compartilha atividade (ex.: read) pra otimização; default = config da WABA.
- **Sync de template:** template novo/reativado leva ~10 min pra sincronizar com a conta de Ads antes de disparar.
- **Webhook de status:** `pricing.category` e `conversation.origin.type` = `marketing_lite` quando roteado via MM API; = `marketing` se caiu no fallback Cloud API. Guardar por `wamid` a origem de cada envio.
- **Send-only:** MM API não recebe mensagens; inbound continua pelo Cloud API/webhook oficial já existente.
- **Restrições geográficas:** EUA bloqueia marketing a usuários locais (erro 131049); EEA/UK/Japão/Coreia/etc. sem otimização de entrega nem métricas de clique; Cuba/Irã/etc. bloqueados.
- **BSUID:** pode enviar por telefone ou BSUID; `bid_spec` não suportado com BSUID (erro 131062). Preferir telefone (mantém `wa_id` nos webhooks).

## 12. Fase 2 — Criação de templates (implementada 2026-07-08)

Builder de modelos de **marketing** e **utilidade** espelhando o Gerenciador do WhatsApp / ManyChat: formulário estruturado à esquerda, **prévia WhatsApp ao vivo** à direita. Envia o modelo pra análise da Meta (`PENDING` → `APPROVED`/`REJECTED`); **não dispara nada** (disparo é Fase 3). Autenticação fica pra depois. Utilidade tem regra de conteúdo estrita: material promocional faz a Meta re-categorizar como marketing.

### 12.1 Fluxo

```
/campanhas → nav "Modelos" → /campanhas/templates?trackingId=…
  ├─ seletor de número (WABA de origem) → campanhas.listTemplates (fetch ao vivo, marketing+utilidade)
  └─ "Novo modelo" → /campanhas/templates/new?trackingId=…
        builder (categoria Marketing/Utilidade • nome+idioma • cabeçalho • corpo+variáveis • rodapé • botões)
        → upload de amostra de mídia (se header IMAGE/VIDEO/DOCUMENT) → campanhas.uploadTemplateSample → header_handle
        → "Enviar para análise" → campanhas.createTemplate → POST /{waba}/message_templates
```

### 12.2 Arquivos

| Camada | Arquivo | Papel |
| --- | --- | --- |
| HTTP | `src/http/whats-oficial/create-message-template.ts` | `createMessageTemplate` → `POST /{waba_id}/message_templates`. |
| HTTP | `src/http/whats-oficial/upload-resumable-media.ts` | `uploadResumableMedia` — Resumable Upload API (App node, `Authorization: OAuth`), devolve `header_handle`. |
| oRPC | `src/app/router/campanhas/list-templates.ts` | Lista templates **marketing + utilidade** (todos os status) da WABA do número. |
| oRPC | `src/app/router/campanhas/create-template.ts` | Valida (`validateTemplateInput`), monta payload (`buildCreateTemplateRequest`), cria na Meta, `logActivity`. |
| oRPC | `src/app/router/campanhas/upload-template-sample.ts` | Recebe base64, sobe amostra via resumable upload (`META_APP_ID/SECRET`), devolve `handle`. |
| Domínio | `src/features/campanhas/server/lib/broadcast-access.ts` | `resolveCampaignMetaCredentials(trackingId, orgId)` → `{ accessToken, wabaId, phoneNumberId }` (tenancy + decifra). |
| Schema | `src/features/campanhas/schema/template-schemas.ts` | Zods (`header`/`body`/`footer`/`buttons` discriminated unions, nome regex Meta). |
| Lib | `src/features/campanhas/lib/build-template-components.ts` | Builder puro estruturado→`components[]`+`example` + `validateTemplateInput` + extração de variáveis. |
| Lib | `src/features/campanhas/lib/template-constants.ts` | Limites Meta, idiomas, categorias, accepts de mídia. |
| Hooks | `src/features/campanhas/hooks/use-templates.ts` | `useTemplates`, `useCreateTemplate`, `useUploadTemplateSample`. |
| UI | `src/features/campanhas/components/templates/{template-builder,whatsapp-preview,templates-list,new-template-view,template-status-badge}.tsx` | Builder + prévia ao vivo + lista + wrapper da rota + badge de status. |
| UI | `src/features/campanhas/components/campanhas-shell.tsx` | Shell com navegação lateral (Campanhas/Modelos/Contatos/Analytics) — substituiu o `campanhas-nav.tsx` (removido). Ver §14. |
| Rota | `src/app/(platform)/(tracking)/campanhas/templates/page.tsx` + `templates/new/page.tsx` | Telas de listagem e criação. |

### 12.3 Suporte de conteúdo

- **Cabeçalho:** Nenhum · Texto (com até 1 variável `{{1}}` + exemplo) · Imagem/Vídeo/Documento (amostra via resumable upload → `header_handle`) · Localização.
- **Corpo:** texto (≤1024) com variáveis `{{1}}…{{n}}` sequenciais + exemplos obrigatórios por variável.
- **Rodapé:** texto opcional (≤60).
- **Botões:** até 10 — Resposta rápida (`QUICK_REPLY`), Acessar site (`URL` estática/dinâmica, dinâmica com `{{1}}`+exemplo), Ligar (`PHONE_NUMBER`), Copiar código (`COPY_CODE`). Limites: ≤2 URL, ≤1 telefone, ≤1 copiar código. **Renderização (regra Meta):** com **>3 botões**, a mensagem mostra só os **2 primeiros** inline + linha **"Ver todas as opções"** (lista); com ≤3, todos inline. A prévia (`whatsapp-preview.tsx`) reflete isso.

### 12.4 Decisões

- **Marketing + Utilidade.** Seletor de categoria (`MARKETING` | `UTILITY`) no topo do builder; o mesmo formulário/endpoint serve as duas (parâmetros posicionais `{{1}}`, sem `parameter_format` — a Meta assume `positional`). Autenticação fica pra depois. A listagem e os cards distinguem por badge de categoria.
- **Fetch ao vivo (sem modelo Prisma).** A listagem vem da Graph a cada abertura (TanStack `staleTime` 15s); o recém-criado aparece `PENDING`. Persistência local fica pra quando o disparo (Fase 3) precisar de índice/estado próprio.
- **Amostra de mídia ≠ mídia do disparo.** O `header_handle` é só pra análise da Meta. No disparo (Fase 3), cada contato pode receber uma mídia própria via parâmetro de header.
- **Validação em duas camadas.** `validateTemplateInput` roda no client (desabilita/erros inline) e no server (`createTemplate` → `BAD_REQUEST`), garantindo payload íntegro antes da Graph.

### 12.5 Env

- `META_APP_ID` / `META_APP_SECRET` — já usados pelo Embedded Signup; o upload de amostra monta o app access token `{id}|{secret}` pro Resumable Upload.

## 13. Fase 3 — Disparo ao vivo (implementada 2026-07-08)

Anexa um template aprovado a uma campanha, mapeia as variáveis e dispara em massa via Inngest, gravando `wamid`/status por destinatário e rastreando entregas/leituras pelo webhook oficial. **Sem cobrança de Stars nesta fase** (adiado, junto da Fase 5).

### 13.1 Fluxo

```
Rascunho (DRAFT) + audiência (Fase 1)
  → aba "Modelo": escolhe template APROVADO + mapeia {{n}} → campanhas.setTemplate
                  (grava templateName/Language/Category + templateVariables)
  → botão "Disparar": campanhas.send
        valida DRAFT + template + destinatários PENDING + APROVAÇÃO na Meta
        → status SENDING + startedAt → inngest.send("campanhas/broadcast.send")
  → Inngest dispatchBroadcast (concurrency por organizationId):
        credenciais resolvidas FORA de step.run (não persiste token no state)
        lotes PENDING (50) em step.run → sendBroadcastMessage → wamid|erro no recipient
        recomputa contadores por lote → finalize: SENT (ou FAILED se 0 enviados) + completedAt
  → Webhook oficial (delivered/read/failed): applyBroadcastStatusUpdates
        casa wamid → BroadcastRecipient (progressão sem downgrade) + recomputa contadores
```

### 13.2 Split de endpoint por categoria

O `Broadcast.templateCategory` (enum Prisma `WhatsAppTemplateCategory { MARKETING, UTILITY, AUTHENTICATION }`) decide o endpoint no `broadcast-sender.ts`:

| Categoria | Endpoint | Client |
| --- | --- | --- |
| MARKETING | `POST /{phone_number_id}/marketing_messages` | `sendMarketingMessage` (otimização/métricas de marketing) |
| UTILITY / AUTHENTICATION | `POST /{phone_number_id}/messages` | `sendOfficialTemplate` (o `/marketing_messages` rejeita não-marketing) |

### 13.3 Arquivos

| Arquivo | Papel |
| --- | --- |
| `prisma/schema.prisma` | enum `WhatsAppTemplateCategory` + `Broadcast.templateCategory` (migration `20260708174706_add_broadcasts_campanhas`, consolidada) |
| `schema/broadcast-schemas.ts` | `broadcastTemplateParamSchema`, `broadcastTemplateMappingSchema`, `setBroadcastTemplateSchema`, `sendBroadcastSchema` |
| `server/lib/broadcast-sender.ts` | resolve variáveis por destinatário + envia pelo endpoint da categoria |
| `server/lib/broadcast-counters.ts` | `recomputeBroadcastCounters` (recompute idempotente: sent/delivered/read/failed) |
| `server/lib/apply-broadcast-status-updates.ts` | casa wamid → `BroadcastRecipient` no webhook (progressão sem downgrade) |
| `router/campanhas/set-template.ts` / `send.ts` | procedures oRPC (anexar template / disparar) |
| `inngest/functions/campanhas/dispatch-broadcast.ts` | handler `campanhas/broadcast.send` (throttle + lotes + finalize) |
| `components/template-config-tab.tsx` | seletor de template aprovado + mapeamento de variáveis do corpo |
| `components/broadcast-detail.tsx` | abas **Modelo** + **Destinatários**, botão "Disparar" (confirm), contadores ao vivo (`refetchInterval` enquanto SENDING). As abas de audiência (Leads/CSV) saíram do disparo — audiência agora é montada em **Contatos** e atrelada; a aba Destinatários guia pro Contatos quando em rascunho |
| `hooks/use-broadcasts.ts` | `useSetBroadcastTemplate`, `useSendBroadcast`, `useBroadcast` com `refetchInterval` |

### 13.4 Mapeamento de variáveis

Cada `{{n}}` do corpo mapeia por destinatário para uma origem: `static` (texto fixo), `recipientName`, `recipientPhone` ou `customField` (chave em `BroadcastRecipient.variables` vindo do CSV). Resolvido no envio (`resolveTemplateParams`) — sem pré-cômputo por destinatário. Header dinâmico fica pra evolução (MVP mapeia só o corpo).

### 13.5 Decisões

- **Sem PORT do chat.** O disparo resolve credenciais Meta direto (`resolveCampaignMetaCredentials`, mesmo padrão do `create-template`) em vez de passar pela `WhatsAppChatProvider` (que é outbound de atendimento). `/marketing_messages` é Meta-only e não pertence àquela porta.
- **Contadores por recompute, não incremento.** `recomputeBroadcastCounters` conta o estado real dos destinatários → idempotente sob retries do Inngest e reentrega de webhooks (sem drift).
- **Aprovação validada no `send`.** Busca os templates da WABA e exige `status === APPROVED` antes de marcar SENDING (evita disparar template PENDING/REJECTED).
- **Stars adiado.** Fase 3 entrega envio + rastreio; a cobrança de Stars entra depois (junto da Fase 5 de saldo/fundos).

## 14. Redesign de navegação & UI (2026-07-08)

Reorganização da UX do app para uma navegação única e um layout mais limpo/moderno/responsivo.

### 14.1 Shell com navegação lateral

`components/campanhas-shell.tsx` — rail lateral no desktop (≥ md) + barra horizontal rolável no mobile. Envolve o conteúdo de **todas** as telas (via `CampanhasShell` + `CampanhasContent`) dando navegação consistente. Substituiu o antigo `campanhas-nav.tsx` (abas no topo, inconsistente entre telas — removido).

Seções: **Campanhas** (`/campanhas`, cobre também o detalhe `/campanhas/<id>`), **Modelos** (`/campanhas/templates`), **Contatos** (`/campanhas/contatos`), **Analytics** (`/campanhas/analytics`).

`components/page-header.tsx` — cabeçalho padrão (ícone + título `tracking-tight` + descrição + slot de ação) usado em todas as telas pra unificar a hierarquia tipográfica.

### 14.2 Contatos (base unificada + atrelar à campanha)

Ambiente único de leads de todos os trackings da org, em **tabela com seleção** (estilo `actions/data-table`): o usuário filtra a base, **seleciona** contatos (checkbox por linha, "selecionar todos" no header, ou **"selecionar todos que casam com o filtro"** quando há mais páginas) e **atrela a uma campanha em rascunho** para disparar.

**Fluxo pretendido:** criar campanha + atrelar modelo → em Contatos, filtrar/selecionar (ou **Importar CSV**, que cria os leads num tracking/etapa escolhidos) → "Atrelar a campanha" abre o disparo já com os destinatários → escolher modelo e disparar.

**Paginação:** por offset (`page`/`pageSize`), com seletor **30/40/60** por página + Anterior/Próximo + total; `keepPreviousData` pra transição suave. Seleção persiste entre páginas; "selecionar todos que casam com o filtro" cobre a base inteira.

**Importar CSV:** `components/import-contacts-dialog.tsx` reusa `parseFile` (`@/features/contacts/hooks/import-lead`) e a procedure `leads.importLead` (`importLeadsBatch`) — **cria leads** no tracking + coluna escolhidos (dedupe, history, Stars). Hook `use-import-contacts.ts` invalida a base de contatos no sucesso. Assim os contatos importados entram na base filtrável e não se perdem.

Procedures:
- `campanhas.listContacts` (cursor; filtros: tracking, coluna/status, tags, temperatura, situação ganho/perdido/ativo, participante, data de criação, busca por nome/telefone) — usa `lib/contacts-query.ts` (`buildContactsWhere`, puro/compartilhado).
- `campanhas.contactFilterOptions` (colunas + participantes do tracking selecionado + tags org-wide — domínio fechado, sem cross-import de `status`/`tags`/`trackings`).
- `campanhas.addRecipientsFromContacts` `{ broadcastId, leadIds? | allMatching? }` — atrela seleção explícita OU "todos que casam com o filtro" à campanha (normaliza telefone, dedupe, atualiza `totalRecipients`). Aceita broadcast `DRAFT` **ou** `FAILED` (ver §15) — se `FAILED`, reabre antes de atrelar.

UI: `components/contacts-view.tsx` (filtros + tabela com seleção + barra de ação) + `components/attach-to-campaign-dialog.tsx` (escolhe a campanha alvo — rascunhos + campanhas que falharam — e redireciona pro disparo). Hooks em `use-contacts.ts`: `useContacts` (infinito), `useContactFilterOptions`, `useAddRecipientsFromContacts`.

### 14.3 Analytics (básico)

`campanhas.analytics` — agregados da org (campanhas, destinatários, enviados, entregues, lidos, falhas), contagem por status e campanhas recentes. UI: `components/analytics-view.tsx` (cards de totais + barras de taxa de entrega/leitura/falha + lista de recentes); hook `use-campanhas-analytics.ts`. "Com o que temos" — sem template analytics/gráficos temporais nesta fase.

### 14.4 Telas existentes

`broadcasts-list` virou lista de cards com pill de status colorido + barra de progresso de envio; `templates-list`/`broadcast-detail` migrados pro `PageHeader` e pro container do shell. Cores de status em `lib/broadcast-status.ts` (`BROADCAST_STATUS_STYLE`). Responsividade: rail colapsa em barra rolável no mobile; listas usam linhas flex (sem overflow de tabela); colunas secundárias somem em telas pequenas.

## 15. CRUD completo + recuperação de campanha que falhou (2026-07-08)

**CRUD na tela de detalhe** (`components/broadcast-detail.tsx`): além de criar (lista) e alterar modelo (aba Modelo), o cabeçalho agora tem menu `⋯` com **Renomear** (`campanhas.update`, diálogo inline) e **Excluir** (`campanhas.delete`, confirmação → redireciona pra `/campanhas`; desabilitado enquanto `SENDING`). Hooks `useUpdateBroadcast`/`useDeleteBroadcast` já existiam; agora consumidos na UI.

**Bug corrigido — campanha travada em `FAILED`.** Quando um disparo falhava (0 enviados → `FAILED` no `finalize` do Inngest), a campanha ficava sem saída: `addRecipientsFromContacts` e `send` só aceitavam `DRAFT`, e o diálogo de atrelar só listava `DRAFT`. Remover o destinatário de dentro dela não ajudava — não dava pra atrelar um lead de novo nem redisparar.

**Recuperação (`reopen`):**
- `lib/broadcast-status.ts` — `EDITABLE_BROADCAST_STATUSES = ["DRAFT","FAILED"]` + `isBroadcastEditable(status)` (compartilhado client/server).
- `server/lib/reopen-broadcast.ts` — `reopenBroadcast(id)`: destinatários `FAILED` → `PENDING` (limpa erro/wamid), broadcast → `DRAFT` (zera `startedAt`/`completedAt`), recomputa contadores. Idempotente.
- `router/campanhas/reopen.ts` — procedure `campanhas.reopen` (só em `FAILED`); botão **Reabrir** no detalhe (`useReopenBroadcast`).
- `addRecipientsFromContacts` agora aceita `DRAFT` ou `FAILED`; se `FAILED`, chama `reopenBroadcast` antes de atrelar. `attach-to-campaign-dialog` lista rascunhos **+** campanhas que falharam (marcadas "falhou — reabre").

Fluxo de recuperação: campanha falhou → **Reabrir** (ou atrelar novos contatos em Contatos, que reabre sozinho) → corrigir modelo/audiência → **Disparar** de novo.

**Visibilidade de falha (por que falhou).** O erro exato da Meta (mensagem + `code`/`subcode`/`fbtrace`) já era gravado por destinatário em `broadcast_recipients.error_message`/`error_code` (catch do `dispatch-broadcast`), mas ficava escondido. Agora:
- `list-recipients` retorna `errorCode`+`errorMessage`; a `RecipientsTable` mostra o motivo em vermelho sob o status do destinatário (texto completo no `title`).
- `reopenBroadcast` **preserva** `errorCode`/`errorMessage` ao reabrir (só reseta status→`PENDING` e limpa o wamid) — o operador vê o motivo do último disparo antes de corrigir. O próximo envio sobrescreve (limpa no sucesso).
- `dispatch-broadcast` ganhou `onFailure`: se a função esgotar os retries, marca os destinatários pendentes como `FAILED` com `DISPATCH_FAILED` + motivo e finaliza o broadcast como `FAILED` — não fica preso em `SENDING`. (Se o Inngest não estiver rodando, o evento não é consumido: rode `pnpm inngest:dev`.)

**9º dígito BR (deliverability).** Causa comum de falha: leads gravados como `55 + DDD + 8 dígitos` (sem o 9), que a Meta rejeita. `lib/whatsapp-phone.ts` (`toWhatsAppBrazilPhone`) insere o 9 em celulares BR sem ele (prefixo local 6–9); fixos, números que já têm o 9 e não-BR ficam intactos (idempotente, testado). Aplicado ao **atrelar** (`add-recipients-from-contacts` — armazenamento canônico) e no **envio** (`broadcast-sender` — rede de segurança pra destinatários gravados antes). Ex.: `558688923098 → 5586988923098`.

## 16. Fase 4 — Agendamento (implementada 2026-07-09)

Agenda o disparo de uma campanha para uma data/hora futura em vez de disparar na hora. Reaproveita a coluna `scheduledAt` e o status `SCHEDULED` já criados na Fase 1 — **sem migration**. Um cron do Inngest varre as campanhas cuja hora chegou e as coloca em disparo pelo mesmo caminho da Fase 3.

### 16.1 Fluxo

```
Rascunho (DRAFT) + template + destinatários (Fases 1–3)
  → "Agendar" (detalhe): escolhe data/hora → campanhas.schedule
        valida igual ao disparo (template APROVADO + destinatários PENDING) + hora futura
        → status SCHEDULED + scheduledAt (NÃO enfileira nada ainda)
  → Cron dispatchDueBroadcasts (a cada minuto):
        SELECT status=SCHEDULED AND scheduledAt <= now  (take 100)
        para cada → beginBroadcastDispatch(fromStatuses:["SCHEDULED"])
          updateMany guardado (SCHEDULED→SENDING) reivindica atomicamente (anti-duplo)
          → inngest.send("campanhas/broadcast.send")  → mesmo dispatchBroadcast da Fase 3
  → "Cancelar agendamento" → campanhas.unschedule (SCHEDULED→DRAFT, limpa scheduledAt)
  → "Disparar agora" → campanhas.send (aceita DRAFT ou SCHEDULED — antecipa o agendamento)
  → "Reagendar" → campanhas.schedule de novo (aceita SCHEDULED, troca a hora)
```

### 16.2 Arquivos

| Arquivo | Papel |
| --- | --- |
| `schema/broadcast-schemas.ts` | `scheduleBroadcastSchema` (`scheduledAt` ISO), `unscheduleBroadcastSchema` |
| `server/lib/assert-broadcast-sendable.ts` | validação compartilhada (rascunho/agendada + template aprovado + pendentes) — usada por `send` e `schedule` |
| `server/lib/begin-broadcast-dispatch.ts` | `beginBroadcastDispatch` — transição atômica `→ SENDING` (updateMany guardado) + `inngest.send`, retorna se reivindicou |
| `router/campanhas/schedule.ts` / `unschedule.ts` | procedures oRPC (agendar/reagendar / cancelar) |
| `router/campanhas/send.ts` | refatorado: usa `assertBroadcastSendable` + `beginBroadcastDispatch`, aceita `DRAFT` **ou** `SCHEDULED` |
| `inngest/functions/campanhas/dispatch-due-broadcasts.ts` | cron `* * * * *` — varre agendadas vencidas e dispara |
| `hooks/use-broadcasts.ts` | `useScheduleBroadcast`, `useUnscheduleBroadcast` |
| `components/broadcast-detail.tsx` | botão **Agendar** (rascunho); banner + **Disparar agora**/**Reagendar**/**Cancelar agendamento** (agendada); diálogo `datetime-local` |
| `components/broadcasts-list.tsx` | card mostra a data agendada quando `SCHEDULED` |

### 16.3 Decisões

- **Sem migration.** `scheduledAt` e `SCHEDULED` já existiam (Fase 1, "colunas já existem, cautela"). Fase 4 é 100% código.
- **Reivindicação atômica anti-duplo.** `beginBroadcastDispatch` faz `updateMany({ where:{ status:{ in:fromStatuses } }, data:{ status:"SENDING" } })` e só enfileira se `count===1`. Protege contra sobreposição de execuções do cron e contra "Disparar agora" concorrente com o cron.
- **Validação no agendar (fail fast).** `schedule` roda a mesma checagem de aprovação Meta do `send`, evitando agendar um disparo que nasceria quebrado. O `dispatchBroadcast` (Fase 3) ainda revalida `status===SENDING` + campos do template.
- **Cron de minuto.** Precisão de ~1 min (query leve, index em `status`). O evento só é consumido com o Inngest rodando (`pnpm inngest:dev`) — igual ao disparo imediato.
- **Fuso local.** O `datetime-local` é interpretado no fuso do operador e convertido pra ISO (UTC) no client antes de enviar; o server valida "futuro" contra o próprio relógio.
