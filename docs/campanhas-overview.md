# App "Campanhas" (Disparos WhatsApp API Oficial) — Planejamento

> Documento de planejamento do novo app de **campanhas de disparo em massa** via **API Oficial do WhatsApp (Meta Cloud API)**. Status: **Fase 1 implementada (2026-07-08) — aguardando `pnpm db:migrate` + ritual pós-migration.** Criado em 2026-07-07.
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

- **Fase 2 — Criação de templates na Meta.** Novo client `create-message-template.ts` (`POST /{waba_id}/message_templates`), procedure `campanhas.createTemplate`, UI de builder (HEADER/BODY/FOOTER/BUTTONS + `example` + categoria MARKETING + idioma), acompanhamento de status de aprovação. **Depende dos docs de criação de template** (a enviar).
- **Fase 3 — Disparo ao vivo.** `provider.sendMarketing` na PORT/`OfficialProvider`, `campanhas.send` → Inngest handler com throttle, cobrança Stars, persistência de wamid/status, extensão do webhook de status pra `BroadcastRecipient`.
- **Fase 4 — Agendamento.** Usa `scheduledAt` + cron scanner `dispatch-due-broadcasts.ts`.
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
