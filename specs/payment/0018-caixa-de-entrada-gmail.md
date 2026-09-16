---
id: 0018
titulo: Caixa de entrada Gmail do financeiro
dominio: payment
status: em-revisao
autor: Weydson
criada: 2026-09-15
atualizada: 2026-09-15
branch: feature/W-astro-finance-tools-20260915
pr: https://github.com/Act962/nasa.ex/pull/392
peso: completa
---

# 0018 — Caixa de entrada Gmail do financeiro (Fase 5)

---

## 1. Contexto

Boleto e nota fiscal chegam por e-mail. Hoje alguém baixa o PDF, sobe em
`/payment` › Documentos (ou anexa no Astro, spec 0014) e pede o lançamento.
Fase 5 do plano "Astro agente financeiro": o sistema lê a caixa Gmail
periodicamente, guarda os anexos como documentos financeiros, já faz a
leitura (extração da spec 0014) e avisa "encontrei N documentos". O lançamento
continua exigindo confirmação (proposta → `confirm_action`).

A integração Google já existe (`PlatformIntegration` `GMAIL` da org, fluxo em
`/integrations`, escopo `gmail.readonly` já em `GOOGLE_SCOPES`). A org guarda
**um** token: o de quem conectou.

## 2. Objetivo

Com a caixa ativada, anexos PDF (e imagens de documento) que chegam no Gmail
conectado viram `PaymentAttachment` lidos e prontos pra lançar, sem duplicar,
e o Astro responde "o que chegou no e-mail?" e lança a partir deles.

### Não-objetivos

- Ler a caixa de cada membro (token por usuário). A caixa é a da conta que
  conectou a integração — limitação documentada na UI e no Astro.
- Push do Gmail (Pub/Sub `watch`). `lastHistoryId` fica reservado.
- Lançar automaticamente sem confirmação.
- Notificação por WhatsApp dedicada (`notifyWhatsapp` reservado; o WhatsApp
  segue a preferência de notificação de cada usuário).
- Cifrar os tokens em `PlatformIntegration.config` (tarefa separada, auditoria
  de segurança).
- Ler corpo do e-mail sem anexo (boleto só com linha digitável no texto).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | `PaymentInboxConfig` por org: `isEnabled` (opt-in, default false), `gmailQuery` (default `has:attachment filename:pdf newer_than:7d`), `lastSyncAt`, `lastError`. |
| RF-2 | Cron `*/30 * * * *` (`paymentInboxSyncCron`) dispara `payment/inbox.sync` por org com caixa ativa e integração GMAIL ativa. `paymentInboxSyncOrg` roda com `concurrency { key: organizationId, limit: 1 }`. |
| RF-3 | Descoberta: lista até 25 mensagens da query, pula mensagens já conhecidas e grava um `PaymentInboxItem` `NEW` por anexo elegível (PDF; imagem ≥ 30 KB), com `@@unique(org, gmailMessageId, gmailAttachmentId)` + `skipDuplicates`. Anexo > 16 MB entra como `FAILED` com motivo. |
| RF-4 | Ingestão (um `step.run` por item, até 20 por execução): baixa do Gmail → `PutObject` em `payment/attachments/<org>/<uuid>.<ext>` → `PaymentAttachment` (`sourceChannel: "gmail"`, `originalFileName`, `uploadedById: null`) → `extractFinancialDocument` (5★, cacheado) → item `PROPOSED` com resumo da extração. |
| RF-5 | Documento `OUTRO` com `confidence < 0.4` → `IGNORED`; o arquivo permanece em Documentos. |
| RF-6 | Executor `payment.entry.create` (spec 0014), após criar, marca `ACCEPTED` + `entryId` o item cujo `attachmentId` foi lançado (best-effort, fora de transação). |
| RF-7 | Ao final do sync, se houve itens `PROPOSED`, notifica quem tem `entries.view` no financeiro: "Encontrei N documentos na caixa <email>". |
| RF-8 | oRPC `payment.inbox`: `getConfig` (entries.view), `updateConfig` (settings.edit), `listItems` (entries.view), `ignoreItem` (entries.edit), `syncNow` (entries.create; exige integração com escopo e caixa ativa). |
| RF-9 | Tools do Astro: `list_inbox_documents({ status?, limit? })`, `sync_gmail_inbox_now()` (sem confirmação — não escreve no financeiro), `propose_ignore_inbox_item({ itemId })` → executor `payment.inbox.ignore`. |
| RF-10 | Seção "Caixa de entrada (Gmail)" com toggle, botão Sincronizar, filtro por status, visualizar anexo e ignorar. Texto deixa explícito: caixa de quem conectou, 5★ por documento. |
| RF-11 | Token resolvido por `resolveGoogleAccessToken({ organizationId, userId?, requiredScope })`, extraído de `sync-google-calendar.ts` sem mudar o comportamento do Calendar. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhuma I/O de rede dentro de `$transaction` (regra 18) — não há transação no fluxo. |
| RNF-2 | Gmail via `fetch` (`src/http/gmail/`), timeout 20 s por chamada; sem `googleapis`. |
| RNF-3 | Uma execução por org por vez; custo por ciclo limitado a 25 mensagens / 20 ingestões. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dada org com caixa ativa e integração GMAIL com `gmail.readonly`, quando o cron roda e há e-mail com PDF na query, então nasce `PaymentInboxItem` `NEW` para cada anexo elegível.
- [ ] **CA-2** — Dado que o mesmo e-mail é listado em dois ciclos (ou dois eventos concorrem), então existe um único item por `(organizationId, gmailMessageId, gmailAttachmentId)`.
- [ ] **CA-3** — Dado item `NEW`, quando ingerido, então existe `PaymentAttachment` com `sourceChannel = "gmail"`, `extraction` preenchida, e o item fica `PROPOSED` com `attachmentId`.
- [ ] **CA-4** — Dado um sync que deixou N ≥ 1 itens `PROPOSED`, então cada usuário com `entries.view` recebe notificação "Encontrei N documento(s)…"; com N = 0 ninguém é notificado.
- [ ] **CA-5** — Dado item `PROPOSED`, quando o usuário pede ao Astro "lança os boletos do e-mail" e confirma, então `read_financial_document` volta `fromCache: true` (sem nova `StarTransaction`), o lançamento é criado com o anexo e o item fica `ACCEPTED` com `entryId`.
- [ ] **CA-6** — Dado refresh token recusado pelo Google, quando o sync roda, então `PaymentInboxConfig.lastError` recebe a mensagem, nenhum item é processado, a função termina sem lançar erro (sem retry do Inngest) e só tenta de novo no próximo ciclo do cron.
- [ ] **CA-7** — Dada org com caixa ativa mas sem `PlatformIntegration GMAIL` ativa, então o cron não dispara evento para ela; `syncNow` responde erro "Conecte a integração Google".
- [ ] **CA-8** — Dado anexo extraído como `OUTRO` com `confidence < 0.4`, então o item fica `IGNORED` e o `PaymentAttachment` continua existindo.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | `attachmentId` do Gmail muda a cada GET da mensagem | Item usa `part:<partId>` como identificador estável; o `attachmentId` fresco é buscado na ingestão (D-3). |
| CB-2 | Sem saldo de Stars ou sem chave de IA | Item fica `NEW` com `errorMessage`; nada cobrado; tenta de novo no próximo ciclo sem baixar o arquivo outra vez. |
| CB-3 | Falha da IA depois de cobrar | Item `FAILED` com motivo (a extração cobrou; não re-tenta sozinho). |
| CB-4 | Anexo removido/mensagem apagada entre descoberta e ingestão | Item `FAILED` "Anexo não encontrado mais no e-mail". |
| CB-5 | Upload no R2 ok mas falha ao gravar no banco | Retry do step cria outro objeto; objeto órfão aceito (mesmo trade-off da rota de upload). |
| CB-6 | Logo/assinatura em imagem | Imagens < 30 KB são descartadas na descoberta. |
| CB-7 | Org sem owner (`Member.role = owner`) no sync automático | Item fica `NEW` com motivo; `syncNow` usa quem clicou. |
| CB-8 | Mesmo PDF enviado em dois e-mails | Dois itens e dois anexos (dedupe é por mensagem); a leitura aponta `possibleDuplicates` e a proposta mostra o aviso (spec 0014, CA-7). |
| CB-9 | Usuário ignora item já lançado | Recusado: "Este documento já virou lançamento". |
| CB-10 | Caixa desativada com evento em voo | `discover` retorna `disabled` e nada é lido. |

## 6. Decisões de design

### D-1 — Caixa da integração da org, não do usuário

- **Escolha**: cron por org usa a `PlatformIntegration GMAIL` (conta de quem conectou). `resolveGoogleAccessToken` aceita `userId` pra quem quiser priorizar o login Google do usuário (Calendar usa), mas o sync não passa.
- **Alternativas descartadas**: token por membro (exige novo fluxo OAuth e modelo por usuário; fora do escopo da fase).
- **Consequência**: a UI e a notificação mostram o e-mail da caixa lida.

### D-2 — Gmail REST por `fetch`

- **Escolha**: `src/http/gmail/{client,list-messages,get-message,get-attachment}.ts`, espelhando `src/http/uazapi`.
- **Alternativas descartadas**: `googleapis` (pacote pesado, problemas de bundling no Turbopack, só 3 endpoints usados).

### D-3 — Identificador estável do anexo = `partId`

- **Escolha**: `gmailAttachmentId` guarda `part:<partId>`. O `body.attachmentId` do Gmail não é estável entre leituras da mesma mensagem, então usá-lo na unique quebraria o CA-2.
- **Consequência**: a ingestão relê a mensagem pra obter o `attachmentId` válido antes do download.

### D-4 — Ingestão por `step.run` e retry só onde nada foi cobrado

- **Escolha**: cada item é um step; sem saldo/sem chave mantém `NEW`, falha pós-cobrança vira `FAILED`; token recusado grava `lastError` e encerra sem throw.
- **Alternativas descartadas**: throw para o Inngest re-tentar (recobraria Stars e martelaria o refresh do Google).

### D-5 — Custo e opt-in

- **Escolha**: ativar a caixa é o opt-in de cobrança; `syncNow` exige caixa ativa. 5★ por documento via `astro_finance_document` (regra existente). `astro_gmail_sync` 0★ entra só no catálogo.

## 7. Impacto

- [x] Schema / migration (`payment_inbox`: `PaymentInboxConfig`, `PaymentInboxItem`, `PaymentInboxItemStatus`)
- [x] Procedures oRPC (`payment.inbox.*`)
- [ ] Realtime (Pusher / event-bus) — só o Pusher já disparado por `createNotification`
- [x] Automações (Inngest: `payment-inbox-sync-cron`, `payment-inbox-sync-org`, evento `payment/inbox.sync`)
- [ ] Env vars novas — usa `GOOGLE_INTEGRATIONS_CLIENT_ID/SECRET/REDIRECT_URI` (já exigidas pela integração)
- [ ] Breaking change para clientes existentes
- [x] Documentação: `docs/ASTRO_PROGRESS.md`, `docs/STARS_OVERVIEW.md`

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 | manual | Conectar Google em `/integrations`, ativar caixa, mandar e-mail com boleto PDF, disparar `payment/inbox.sync` no `pnpm inngest:dev`; conferir item `NEW`→`PROPOSED`. |
| CA-2 | manual | Disparar o evento duas vezes seguidas; `count` por `gmail_message_id` = nº de anexos. |
| CA-3 | manual | `payment_attachments.source_channel = 'gmail'` e `extraction` não nula. |
| CA-4 | manual | Sininho mostra "Encontrei 1 documento…"; sem documentos novos, nada. |
| CA-5 | manual | "o que chegou no e-mail?" → "lança" → "sim"; `star_transactions` sem nova linha da leitura; item `ACCEPTED`. |
| CA-6 | manual | Corromper `refreshToken` e expirar `expiresAt` no config; rodar sync; `last_error` preenchido, run do Inngest concluído. |
| CA-7 | manual | Desativar integração; cron não dispara; `syncNow` retorna erro. |
| CA-8 | manual | Enviar PDF não financeiro (ex.: cardápio); item `IGNORED`, anexo em Documentos. |

Não há runner de teste instalado (CLAUDE.md §20); os CAs ficam como roteiro manual até a Fase 0.

## 9. Riscos e rollback

- **Tokens em texto puro** em `PlatformIntegration.config` — risco pré-existente, ampliado pelo uso de `gmail.readonly`.
- **Custo inesperado**: caixa com muitos PDFs não financeiros consome 5★ por arquivo. Mitigação: opt-in explícito, query editável, teto de 20 ingestões por ciclo.
- **Tipo de notificação**: usa `NOTIF_TYPES.CUSTOM` (sem preferência dedicada) até existir `PAYMENT_INBOX_FOUND`.
- **Rollback**: desativar as funções Inngest / `isEnabled = false`. Migration aditiva: `DROP TABLE payment_inbox_items; DROP TABLE payment_inbox_configs; DROP TYPE "PaymentInboxItemStatus";`.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-15 | Weydson | Criada |
