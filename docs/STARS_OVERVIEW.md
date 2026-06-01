# Stars — Visão Geral do Sistema

> Documento de referência para extensão da feature de Stars (moeda interna do N.A.S.A).
> Gerado em 2026-05-22 a partir da auditoria do código atual.
> Atualizado em 2026-05-29: recarga via Stripe com quantidade customizada + webhook dedicado `/api/stars/webhook`.
> Complementa (e em alguns pontos atualiza) o [STARS_AUDIT.md](STARS_AUDIT.md).

---

## 1. O que são Stars

Stars (★) são a moeda interna do app. Cada organização tem um saldo e gasta stars ao executar ações "caras" — chamadas de IA, geração de mídia, automações, uploads de vídeo, etc. O saldo é reabastecido por:

- **Plano mensal** (assinatura recorrente — credita `monthlyStars` no início do ciclo);
- **Top-up** (compra avulsa de pacote);
- **Welcome bonus** (100★ na primeira interação, salvos em saldo separado);
- **Rollover** (parte das stars não usadas viram crédito no próximo ciclo).

---

## 2. Modelo de dados

Schema em [prisma/schema.prisma](../prisma/schema.prisma) (faixa ~2337–2486 e ~3276–3435).

| Modelo | Função |
| --- | --- |
| `Plan` | Catálogo de planos (slug: `free`, `earth`, `explore`, `constellation`, `suite`). Campos chave: `monthlyStars`, `rolloverPct` (default 30%), `billingType`, `stripeProductId`, `stripePriceId`, `maxUsers`. |
| `StarPackage` | Pacotes avulsos (top-up) — `stars`, `priceBrl`, `label`, `isActive`. |
| `AppStarCost` | Catálogo **global** de custos por ação — `appSlug` (unique), `monthlyCost`, `setupCost`, `category` ("action" \| "app"), `isPublic`. Editável via admin sem deploy. |
| `StarRule` | Override **por organização** (`orgId + action`, `stars`, `cooldownHours`, `isActive`). Cache em memória (TTL 5min) em [src/features/stars/lib/rules-cache.ts](../src/features/stars/lib/rules-cache.ts). |
| `StarTransaction` | Auditoria completa. `amount` (+/-), `balanceAfter`, `type` (enum), `appSlug`, `userId`. Indexada por `[organizationId, createdAt]` e `[type]`. |
| `MemberStarBudget` | Cota por usuário (`monthlyBudget`, `currentUsage`, `cycleStart`). Unique `[organizationId, userId]`. |
| `StarsPayment` | Checkout intermediário p/ gateways — `status` (pending/paid/failed/expired/**refunded**), `provider`, `externalId` (session id), **`stripePaymentIntentId`** (lookup de refund + fallback), **`paidAt`/`refundedAt`**, `packageId` **nullable** (null = quantidade customizada), `metadata`. |
| `ProcessedStripeEvent` | Dedupe de eventos Stripe por `event.id` (PK). Evita reprocessar entregas duplicadas no webhook de Stars. |

### Campos no `Organization`
- `starsBalance` — saldo principal (planos + top-ups, gasta primeiro);
- `starsBonusBalance` — bônus (welcome, promos). **Não cobre cursos do NASA Route nem hospedagem de vídeo** (`allowBonus: false`);
- `starsCycleStart` — início do ciclo de 30 dias;
- `starsAlertConfig` — JSON com thresholds customizáveis;
- `starDistributionMode` — `"org"` (pool) | `"equal"` (dividido) | `"custom"` (por user);
- `planId` — FK para `Plan` ativo.

### Enum `StarTransactionType`
`PLAN_CREDIT`, `TOPUP_PURCHASE`, `APP_CHARGE`, `APP_SETUP`, `ROLLOVER`, `MANUAL_ADJUST`, `REFUND`, `COURSE_PURCHASE`, `COURSE_PAYOUT`, `WELCOME_BONUS`, `EVENT_TICKET_PURCHASE`, `EVENT_TICKET_PAYOUT`.

---

## 3. Como stars são consumidas

### 3.1. Motor de débito
[src/features/stars/lib/star-service.ts:129](../src/features/stars/lib/star-service.ts) — função `debitStars(orgId, amount, type, description, appSlug?, userId?, opts?)`:

1. Transação Prisma atômica.
2. Soma `starsBalance + starsBonusBalance` (ou só `starsBalance` se `allowBonus: false`).
3. Se insuficiente → retorna `{ success: false, cost, newBalance, newBonusBalance }`.
4. Debita primeiro `starsBalance`, depois `starsBonusBalance`.
5. Cria `StarTransaction` com snapshot `balanceAfter`.
6. Incrementa `MemberStarBudget.currentUsage` (se `userId` informado).
7. **Auto-refill de moderador**: se saldo ≤ 100 E a org tem membro com `role="moderador"`, recarrega para 1.000.000★ e registra `MANUAL_ADJUST`.

### 3.2. Wrapper de cobrança
[src/features/stars/lib/charge-by-action.ts](../src/features/stars/lib/charge-by-action.ts) — `chargeStarsByAction(orgId, action, ctx)`:
- Resolve custo via `StarRule` (override por org) → fallback `AppStarCost` global.
- Se `monthlyCost = 0`, cobrança fica **desativada** sem alterar código.

### 3.3. Ações que cobram hoje

| Feature | Arquivo | Action key | Custo |
| --- | --- | --- | --- |
| Astro IA — chat | [src/app/api/astro/chat/route.ts:116](../src/app/api/astro/chat/route.ts) | `astro_prompt` | 5★ stake + variável por tokens (1★ = 1000 tokens) |
| Astro IA — booking público | [src/app/api/public/booking-chat/route.ts:137](../src/app/api/public/booking-chat/route.ts) | `astro_prompt` | 5★ (erro ignorado silenciosamente) |
| Insights — relatório IA | [src/app/router/insights/generate-report.ts:94](../src/app/router/insights/generate-report.ts) | `insights_report_ai` | 10★ |
| NASA Planner — gerar post | (planner) | `ai_response_generate` | 5★ |
| NASA Planner — imagem IA | (planner) | hardcoded | 3★ |
| NASA Planner — vídeo IA | [src/app/router/nasa-planner/generate-video-clip.ts:49](../src/app/router/nasa-planner/generate-video-clip.ts) | hardcoded | variável |
| NASA Planner — publicar/agendar | (planner) | hardcoded | 1★ |
| NASA Command — execute | (command) | `ai_command_execute` | 5★ |
| Forge — criar proposta | (forge) | `forge_proposal_create` | 3★ |
| Forge — enviar proposta | (forge) | `forge_proposal_send` | 2★ |
| NASA Route — start upload vídeo | [src/app/router/nasa-route/routes/creator-start-video-upload.ts:76](../src/app/router/nasa-route/routes/creator-start-video-upload.ts) | dinâmico | calculado por GB em [src/features/nasa-route/lib/video-storage-pricing.ts](../src/features/nasa-route/lib/video-storage-pricing.ts) — `allowBonus: false` |
| NASA Route — complete upload | (route) | `nasa_route_video_upload_complete` | 20★ |
| Calendar share | [src/app/router/org/enable-calendar-share.ts:59](../src/app/router/org/enable-calendar-share.ts) | `calendar_share_enable` | 5★ |
| Meta Ads — tools Astro | [src/app/router/ia/ai-workspace/tools/meta-ads/_shared.ts](../src/app/router/ia/ai-workspace/tools/meta-ads/_shared.ts) | hardcoded | variável |
| Workflow execute | (workflow) | `workflow_execute` | 2★ |
| Pages — criar página | (pages) | hardcoded | 2★ |

> **Padrão arquitetural:** toda ação cara DEVE cobrar via `chargeStarsByAction` **antes** de executar a operação. Custos hardcoded são dívida técnica — migrar para `AppStarCost` quando tocar a feature.

---

## 4. O que acontece quando acaba

**Não há middleware global** — cada feature trata seu próprio "saldo insuficiente":

| Feature | Resposta |
| --- | --- |
| Astro chat | HTTP **402 Payment Required** → frontend abre modal de compra |
| Insights | `ORPCError("PRECONDITION_FAILED")` |
| NASA Route upload | Erro com `saldoAtual` / `necessário` no payload |
| Calendar share | `ORPCError("PRECONDITION_FAILED")` |
| Meta Ads | `ORPCError("PRECONDITION_FAILED")` |
| Booking público | **Silencia o erro** — chat continua sem cobrar |

O retorno padrão do `debitStars` traz `{ success: false, cost, newBalance, newBonusBalance }` — o componente client decide entre abrir o `StarsPurchaseModal`, o `PlanSelectModal`, ou exibir aviso.

**Alertas visuais**: `StarsWidget` marca `isLow` em ≥80% consumido e `isCritical` em ≥95% — configurável por `starsAlertConfig`.

---

## 5. Como adquirir mais stars

### 5.1. Top-up via Stripe (atual) — preço uniforme + quantidade customizada

Preço **uniforme** R$/★ (`RouterPaymentSettings.starPriceBrl`, default R$0,15). Presets são só atalhos de quantidade; o cliente pode digitar qualquer valor acima do mínimo (R$5,00 ≈ 33★). PIX fica para depois — este fluxo é exclusivamente cartão.

1. `StarsPurchaseModal` carrega `orpc.stars.getStarsPricing` (preço, mínimo, presets) e exibe saldo via `getBalance`. Tudo via hooks em [src/features/stars/hooks/use-stars-purchase.ts](../src/features/stars/hooks/use-stars-purchase.ts).
2. Usuário escolhe preset ou digita a quantidade → total em BRL ao vivo.
3. `orpc.stars.createStarsCheckout({ stars, returnPath })` ([src/app/router/stars/create-stars-checkout.ts](../src/app/router/stars/create-stars-checkout.ts)) valida o mínimo, aplica desconto de parceiro (snapshot), cria `StarsPayment` (status `pending`, `packageId: null`) e abre **Stripe Checkout Session** com `metadata.kind = "stars_topup"` (propagado também em `payment_intent_data.metadata`) e `idempotencyKey: stars-topup:<paymentId>`.
4. Cliente é redirecionado pro Checkout. O crédito é **assíncrono** — acontece no webhook dedicado `/api/stars/webhook` (ver §9). Ao voltar com `?stars=success`, o `StarsWidget` faz polling do saldo até refletir o crédito.

> **Cupom:** o Checkout habilita `allow_promotion_codes` — o cliente pode aplicar um **Promotion Code** (criado no Stripe Dashboard) na própria página de pagamento. O desconto reduz o `amount_total` pago, mas as **Stars creditadas continuam cheias** (o cupom é um benefício de preço, não reduz a quantidade). Cupom e desconto de parceiro podem coexistir (ambos reduzem o valor pago).

> Existem fluxos legacy preservados (não usados pelo modal novo): `createGatewayCheckout` (multi-gateway, base do PIX/Asaas futuro) e `createCheckoutSession` + `purchasePackage` (Stripe legado por `StarPackage`).

### 5.2. Plano mensal
1. `orpc.stars.listPlans` retorna planos ativos.
2. Checkout via gateway com `metadata.itemType = "plan"`.
3. Webhook associa `Organization.planId`, inicia `starsCycleStart` e executa `runMonthlyCycle` na **primeira** vez.

### 5.3. Welcome bonus
- 100★ creditados em `starsBonusBalance` na primeira chamada de `checkBalance` ([star-service.ts:61-84](../src/features/stars/lib/star-service.ts)).
- Tipo de transação: `WELCOME_BONUS`.

### 5.4. Desconto NASA Partner
- `createStarsCheckout` / `createGatewayCheckout` aplicam snapshot de pricing de partner antes de criar a sessão. Para compras sem pacote (quantidade customizada), `processPaymentPartnerEffects` sintetiza o snapshot a partir do próprio `StarsPayment` — comissão de parceiro continua valendo.

---

## 6. Uso extra / overage

**Não existe cobrança automática por consumo excedente.**

- Usuário que zera o saldo simplesmente é bloqueado nas features caras (402 / PRECONDITION_FAILED) até comprar top-up ou upgrade.
- **Plano `suite`** é "pay-per-use" no sentido de não exibir barra de limite ([get-usage-breakdown.ts:52](../src/app/router/stars/get-usage-breakdown.ts) — `showLimitBar = false`), mas **ainda cobra por ação** e ainda bloqueia quando o saldo zera. Não há linha de crédito / billing pós-pago.
- Não há rate-limiting automático, nem `cooldownHours` implementado (campo existe em `StarRule` mas não é consumido).

> **Oportunidade clara de produto:** modelo de overage real (continuar usando e cobrar fim do mês) ainda precisa ser desenhado — hoje a única "rota de fuga" do limite é compra antecipada.

---

## 7. Procedures oRPC

Todas em [src/app/router/stars/](../src/app/router/stars/):

| Procedure | Função |
| --- | --- |
| `getBalance` | Saldo + metadados de plano + ciclo |
| `listTransactions` | Histórico paginado |
| `listPackages` | Pacotes ativos de top-up |
| `purchasePackage` | Compra direta (legacy) |
| `getAppCost` | Custo de uma action key |
| `updateAlertConfig` | Customiza thresholds de alerta |
| `listPlans` | Planos de assinatura |
| `createCheckoutSession` | Stripe checkout legacy |
| `listActiveGateways` | Gateways configurados |
| `createGatewayCheckout` | Checkout multi-gateway (legacy/base PIX futuro) |
| `createStarsCheckout` | **Checkout Stripe (atual)** — quantidade customizada, preço uniforme |
| `getStarsPricing` | **Config pro modal** — preço R$/★, mínimo, presets |
| `getDistribution` / `setDistribution` | Modo de distribuição entre membros |
| `setMemberBudget` | Cota por usuário (modo `custom`) |
| `getUsageBreakdown` | Agregação no ciclo (top apps + top users) |
| `listActionCosts` | Lista admin de todas as ações |

Admin: [src/app/router/admin/star-rules.ts](../src/app/router/admin/star-rules.ts) — `adminGetStarRules`, `adminCreateStarRule`, `adminUpdateStarRule`.

> Os hooks de compra já vivem em [src/features/stars/hooks/use-stars-purchase.ts](../src/features/stars/hooks/use-stars-purchase.ts) (`useStarsBalance`, `useStarsPricing`, `useCreateStarsCheckout`). Os demais componentes (widget, history, distribution) ainda importam `orpc` direto — refator pendente pra alinhar 100% ao [CLAUDE.md](../CLAUDE.md#9).

---

## 8. UI

Componentes em [src/features/stars/components/](../src/features/stars/components/):

- `StarsWidget` — pill no header, popover com saldo, alertas e botão "+"
- `StarsPurchaseModal` — compra via Stripe (presets + quantidade customizada → checkout); crédito assíncrono via webhook
- `PlanSelectModal` / `PlanPurchaseModal` / `SubscriptionPlansModal` — fluxos de plano
- `StarsHistoryDialog` — tabela paginada de `StarTransaction`
- `StarsLearnCard` — educacional
- `StarsAlertSettings` — config de threshold por org
- `StarDistributionSettings` — escolhe modo `org`/`equal`/`custom`
- `StarCostBadge` — exibe custo de uma ação em CTA
- `StarIcon` — ícone base

---

## 9. Webhooks

### 9.1. Webhook dedicado de Stars (atual) — `/api/stars/webhook`

[src/app/api/stars/webhook/route.ts](../src/app/api/stars/webhook/route.ts). **Endpoint próprio** (separado do de cursos/better-auth). Usa o **Stripe do sistema** (`STRIPE_SECRET_KEY` via `getStripe()` no checkout; `STRIPE_STARS_WEBHOOK_SECRET` na verificação de assinatura) — não depende de `PaymentGatewayConfig`. Crédito/estorno via helpers em [src/features/stars/lib/stars-topup-helpers.ts](../src/features/stars/lib/stars-topup-helpers.ts).

| Evento | Ação | Idempotência |
| --- | --- | --- |
| `checkout.session.completed` | Só `kind=stars_topup` + `payment_status=paid`. Grava `stripePaymentIntentId`, credita Stars (`finalizeStarsTopUpInTx`), partner effects + PostHog. | `ProcessedStripeEvent` (event.id) + claim atômica `updateMany where status='pending'` |
| `payment_intent.succeeded` | Fallback (async / entrega perdida). Acha o payment por metadata ou `stripePaymentIntentId` e finaliza. | mesma claim — 2º evento vira no-op |
| `checkout.session.expired` | Marca `StarsPayment` `pending → expired`. | claim `where status='pending'` |
| `charge.refunded` (total) | Acha o payment por `stripePaymentIntentId` e debita as Stars creditadas (`revertStarsTopUpInTx`). **Permite saldo negativo.** Parcial → só log. | claim `where status='paid'` |
| `charge.dispute.created` | Não reverte (merchant pode contestar). Log + Inngest `stripe/charge.dispute.created` (notificação manual). | `ProcessedStripeEvent` |

**Garantias:** crédito/débito são atômicos (`{ increment }`), não read-modify-write. `finalizeStarsTopUpInTx` credita a **quantidade comprada cheia** mesmo com cupom/desconto aplicado (o cupom reduz o valor pago, não as Stars) e **nunca credita mais que o comprado** (`unit_amount` fixo → sem over-credit). Org em grace/suspensa tem `starsGraceStartedAt`/`starsSuspendedAt` limpos quando o saldo volta a ser positivo. Pendências órfãs (>24h) são varridas pelo cron `stars-pending-sweep` (de hora em hora).

**Hardening de segurança (checkout):**
- Preço/valor calculados **server-side** (`stars × starPriceBrl`) — o client nunca envia preço. `organizationId` vem da sessão, não do input (sem IDOR).
- Limites validados (zod + handler): mínimo R$5 (~33★) e **máximo `MAX_TOPUP_STARS` = 1.000.000★** — evita cobranças absurdas / estouro no Stripe.
- `returnPath` sanitizado contra open-redirect (só path interno limpo; rejeita `//`, `\`, `:` e whitespace) e o `success_url`/`cancel_url` é sempre prefixado pelo `ORIGIN`.
- Reuso de checkout pendente recente (mesmo user + quantidade, <15min, sessão ainda `open`) em vez de criar cobranças paralelas; double-click é barrado no client e retry de rede pelo `idempotencyKey`.
- Webhook **fail-closed**: exige `STRIPE_STARS_WEBHOOK_SECRET` — não cai no secret compartilhado. Eventos são processados só com `kind=stars_topup` (ou lookup por `stripePaymentIntentId`), ignorando eventos de cursos/planos.

**Configuração no Stripe Dashboard:** criar endpoint `/api/stars/webhook` assinando `checkout.session.completed`, `payment_intent.succeeded`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`.

### 9.2. Webhook compartilhado — `/api/stripe/webhook`

[src/app/api/stripe/webhook/route.ts](../src/app/api/stripe/webhook/route.ts) — cursos NASA Route, planos e top-up legacy. **Não credita mais Stars do fluxo de gateway novo** (movido pro endpoint dedicado).

- `checkout.session.completed` → cursos (`PendingCoursePurchase`), `plan` (vincula + `runMonthlyCycle`), top-up legacy (`itemType=topup` → `purchaseTopUp`).
- `invoice.payment_succeeded` / `customer.subscription.deleted` — **TODO** (renovação/cancelamento de plano).

Asaas webhook (`/api/payments/asaas/webhook`): recredita top-ups PIX/boleto via `purchaseTopUp` (fluxo `createGatewayCheckout`).

---

## 10. Inngest / ciclo mensal

**Gap importante:** não existe job Inngest recorrente que rode `runMonthlyCycle` em todas as orgs ativas. Hoje o ciclo só é executado:

- Na **primeira** compra de plano (webhook Stripe);
- Manualmente, se chamado em outro fluxo.

Implicação: orgs com plano ativo mas sem novo evento de pagamento **não têm o saldo resetado nem rollover aplicado** automaticamente todo mês. Crons relacionados existem para outras features ([partner-payout-close-cycle.ts](../src/features/partner/), [nasa-route-subscription-renew.ts](../src/features/nasa-route/)) — usar como template.

---

## 11. Auditoria e relatórios

- **Cada** débito/crédito gera `StarTransaction`.
- `getUsageBreakdown` ([src/app/router/stars/get-usage-breakdown.ts](../src/app/router/stars/get-usage-breakdown.ts)) entrega:
  - `consumedInCycle`, `cycleStart`, `cycleEnd`
  - `byApp` (top 5)
  - `byUser` (top 10)
  - `planMonthlyStars`, `planSlug`, `planName`, `showLimitBar`

---

## 12. Distribuição entre membros

`Organization.starDistributionMode`:
- `"org"` (default) — pool único compartilhado;
- `"equal"` — dividido igualmente entre membros ativos;
- `"custom"` — `MemberStarBudget` por usuário.

`MemberStarBudget.currentUsage` é incrementado em todo débito com `userId`. **Enforcement de bloqueio quando user estoura seu budget ainda não está implementado** (fase 3) — hoje é apenas rastreio.

---

## 13. Planos conhecidos

| Slug | Características |
| --- | --- |
| `free` | 0★/mês (trial) |
| `earth` | Faixa de entrada |
| `explore` | Faixa intermediária |
| `constellation` | Faixa alta |
| `suite` | Pay-per-use (sem barra de limite, mas ainda cobra por ação) |

Cada plano tem `monthlyStars`, `rolloverPct` (default 30%), `priceMonthly`, `maxUsers` (default 3), `benefits` (JSON), `stripePriceId`.

---

## 14. Resumo de status (extensão da feature)

| Aspecto | Status | Notas |
| --- | --- | --- |
| Schema de dados | ✅ Completo | 7 modelos, enum rico de tipos |
| Cobrança por ação | ✅ Funcional | ~15 ações ativas; alguns custos ainda hardcoded |
| Bloqueio quando zera | ✅ Por feature | Sem middleware global; cada rota trata |
| Top-up | ✅ Completo | Stripe + Asaas via `createGatewayCheckout` |
| Planos | ✅ Catalogados | Compra OK, renovação **incompleta** |
| Welcome bonus | ✅ | 100★ em `starsBonusBalance` na 1ª chamada |
| Rollover | ⚠️ Estrutura existe | Dependente do `runMonthlyCycle` rodar |
| **Overage / pós-pago** | ❌ Inexistente | Oportunidade clara de produto |
| Ciclo mensal automático | ❌ Sem cron | Só roda no 1º plano via webhook |
| Distribuição custom | ⚠️ Rastreia, não bloqueia | Enforcement de budget pendente |
| Cooldown / rate-limit | ❌ Campo existe, não usado | `StarRule.cooldownHours` |
| Hooks client em `features/stars/hooks/` | ❌ | Componentes importam `orpc` direto (anti-padrão) |
| Webhook Asaas | ❓ A confirmar | Não localizado nesta auditoria |
| Renovação Stripe (invoice / subscription deleted) | ❌ TODO no código | Comentários explícitos no webhook |

---

## 15. Pontos de atenção para novas features

1. **Sempre** cobrar via `chargeStarsByAction(orgId, "<chave_da_acao>")` antes de executar — e cadastrar a chave em `AppStarCost` (não hardcodar custo).
2. Decidir explicitamente se a ação aceita bônus (`allowBonus`) — hospedagem e cursos do Route não aceitam.
3. Para qualquer cobrança nova, escolher o `StarTransactionType` correto — se for tipo novo, **estender o enum** no schema (migração obrigatória).
4. Hooks novos devem viver em `src/features/stars/hooks/use-stars-*.ts` (padrão do CLAUDE.md — atualmente violado pelos componentes existentes).
5. Antes de mexer no ciclo mensal: implementar o cron Inngest faltante; senão qualquer lógica de rollover/credit fica dependendo de evento externo.
6. Para introduzir overage real, considerar: nova flag em `Plan` (`allowOverage`), tabela `OverageLedger`, fechamento de ciclo cobrando o consumo excedente via gateway recorrente, e novo `StarTransactionType` (ex: `OVERAGE_CHARGE`).
