# Modelo de assinatura por empresa (billing-role propagation)

> **Regra de manutenção (OBRIGATÓRIA)**
>
> Toda mudança que toque qualquer um dos pontos abaixo **deve atualizar este documento na mesma sessão**:
>
> - schema: `Subscription` / `Plan` / `Organization.planId` em `prisma/schema.prisma`
> - hooks de auth em `src/lib/auth.ts` (subscription, organization, databaseHooks)
> - helpers de billing em `src/features/billing/`
> - webhooks Stripe: `src/app/api/stripe/**`, `src/app/api/stars/webhook/**`, ou rotas registradas pelo plugin em `/api/auth/stripe/webhook`
> - UI de billing: `src/app/(platform)/subscription/**`, `src/app/(platform)/(tracking)/settings/billing/**`, `src/features/stars/components/subscription-plans-modal.tsx`
> - regras de role em `src/hooks/use-org-role.ts` ou helpers de permissão de billing
>
> Atualizações esperadas: adicionar/ajustar caso de uso na tabela, atualizar os fluxos (sequence), renovar **Última atualização** no topo, e — se mexeu em arquivo crítico — confirmar que o nome ainda bate com o que está aqui. Documentos desatualizados são piores que documentos ausentes.

**Última atualização**: 2026-06-02
**Status**: 🟢 Frentes A/B/C/D implementadas na branch `feature/tracking-billing-roles-subscription-20260602` — falta smoke test manual em dev e merge.

---

## TL;DR

- A `Subscription` (better-auth/stripe) vive **por usuário** (`referenceId = userId`).
- Quando esse usuário tem role `owner` ou `admin` em uma org, o plano **propaga** pra `Organization.planId` daquela org.
- Resultado: 1 cobrança Stripe cobre N orgs do mesmo pagante; `member`/`moderador` apenas usufruem.

## Modelo conceitual

| Camada | Onde mora | Quem atualiza |
|---|---|---|
| Cobrança | Stripe + `Subscription.referenceId = userId` | Plugin `@better-auth/stripe` via webhook em `/api/auth/stripe/webhook` |
| Plano da empresa | `Organization.planId` | Hooks `onSubscriptionComplete/Update/Cancel` + `afterCreateOrganization` em `src/lib/auth.ts` |
| Consumo de Stars | `Organization.starsBalance` + ciclo | `runMonthlyCycle(orgId)` (já existente) |

A regra de propagação está concentrada em `src/features/billing/lib/sync-billing-role-plan-to-orgs.ts`:

```
Para cada org onde Member.userId = X e Member.role ∈ {owner, admin}:
  - newPlanId = id do plano da sub ativa do X
  - se newPlanId é null:
      só zera Organization.planId se nenhum OUTRO owner/admin daquela org tem sub ativa
  - se primeiro ciclo: runMonthlyCycle(orgId)
```

## Roles

Convencionou-se **`billing-role = {owner, admin}`** neste projeto. Roles do better-auth/organization em uso: `owner`, `admin`, `member`, `moderador` (ver `src/hooks/use-org-role.ts`).

| Role | Pode assinar? | Pode acessar billing portal? | Vê plano da empresa? | Conta na propagação? |
|---|---|---|---|---|
| `owner` | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ | ✅ |
| `member` | ❌ | ❌ | ✅ (read-only) | ❌ |
| `moderador` | ❌ | ❌ | ✅ (read-only) | ❌ |

## Casos de uso

| # | Caso | Comportamento esperado |
|---|---|---|
| 1 | Billing-role sem plano cria nova org | Org fica em "Grátis" (default) |
| 2 | Billing-role com plano cria 2ª org | Nova org herda o plano via `afterCreateOrganization` (criador vira `owner` por default do plugin) |
| 3 | Billing-role faz upgrade do plano | Todas as orgs onde ele é owner/admin recebem novo `planId` + `runMonthlyCycle` |
| 4 | Billing-role cancela plano (immediate) | Cada org dele: só zera `planId` se nenhum OUTRO owner/admin daquela org tem sub ativa |
| 5 | Billing-role cancela plano (at period end) | `Subscription.cancelAtPeriodEnd = true`; `planId` só zera no `period_end` |
| 6 | Sub entra em `past_due` (falha de pgto) | Mantém `planId` mas inicia `starsGraceStartedAt` (15 dias — fluxo de grace já existe) |
| 7 | Billing-role tenta sair de org com sub ativa | **Bloqueado** com mensagem "cancele sua assinatura antes" |
| 8 | Billing-role tenta transferir ownership com sub ativa | **Bloqueado** (mesma razão) |
| 9 | Member/moderador tenta acessar `/subscription/confirm` | Redirect pra `/home` |
| 10 | Member/moderador tenta abrir billing portal | 403 via `authorizeReference` |
| 11 | Org tem 2 billing-roles, ambos com plano | Org pega o plano com maior `Plan.sortOrder` (regra "highest wins") |
| 12 | Billing-role é demovido pra member/moderador | Sub sai do scope dele pra essa org; recalcular `planId`. **Bloqueado** se ele era o único pagante cobrindo a org |
| 13 | Admin é promovido a owner (ou vice-versa) | Sem efeito no plano — ambas as roles contam como billing-role |
| 14 | Member é promovido a admin (e novo admin tem sub ativa) | Org herda plano do novo admin via `afterUpdateMemberRole` (ver Open Q 2) |
| 15 | Stripe webhook chega fora de ordem | `onSubscriptionUpdate` é idempotente — sempre rederive do status atual |
| 16 | User cria sub direto no Stripe Dashboard (sem checkout do app) | Plugin do better-auth detecta via webhook e dispara `onSubscriptionComplete` normalmente |

## Arquivos críticos

### Configuração (existentes)
- `src/lib/auth.ts:259` — plugin Stripe (vai receber `authorizeReference` + 3 hooks)
- `src/lib/auth.ts:197` — `organizationHooks.afterCreateOrganization` (auto-herança)
- `src/lib/auth-client.ts` — `stripeClient({ subscription: true })`

### Helpers (a criar)
- `src/features/billing/lib/sync-billing-role-plan-to-orgs.ts` — propagação central
- `src/features/billing/lib/guard-billing-role-exit.ts` — guard de saída/transferência/demotion
- `src/features/billing/lib/can-manage-billing.ts` — `role === 'owner' || role === 'admin'`
- `src/features/billing/hooks/use-active-org-plan.ts` — hook client que lê `Organization.planId` via `getBalance`
- `src/features/billing/hooks/use-can-manage-billing.ts` — baseado em `useOrgRole`

### UI (existentes, vão ser ajustados)
- `src/app/(platform)/subscription/confirm/page.tsx` — guard billing-role-only
- `src/app/(platform)/(tracking)/settings/billing/page.tsx` — view diferenciada owner/admin vs member
- `src/features/stars/components/subscription-plans-modal.tsx` — esconder CTAs pra non-billing-role

### Backend (descobrir + plugar guard)
- `src/app/router/permissions/*` — rotas de membership (onde plugar `guard-billing-role-exit`)

### Webhooks
- **`/api/auth/stripe/webhook`** — endpoint do plugin `@better-auth/stripe`. Auto-registrado pelo catch-all `src/app/api/auth/[...all]/route.ts`. **Já funciona** hoje. Onde `onSubscriptionComplete/Update/Cancel` vão disparar.
- `src/app/api/stripe/webhook/route.ts` — webhook **legacy** custom em URL separada (`/api/stripe/webhook`). Cobre Stars/cursos via metadata. **Não conflita** com o do plugin.
- `src/app/api/stars/webhook/route.ts` — webhook dedicado de recarga de Stars (`STRIPE_STARS_WEBHOOK_SECRET`). Independente.

### Schema (sem mudança planejada)
- `prisma/schema.prisma:2733` — `Subscription` (já tem `referenceId`)
- `prisma/schema.prisma:196,208` — `Organization.planId`
- `prisma/schema.prisma:2706` — `Plan.sortOrder` (usado pra "highest wins" no caso 11)

## Fluxos (sequence)

### Billing-role assina (caso 3 — upgrade)

```
UI: authClient.subscription.upgrade({ plan: "pro" })   ← sem referenceId, default = user.id
 → Stripe Checkout
 → POST /api/auth/stripe/webhook   (endpoint do plugin)
 → Plugin: onSubscriptionComplete({ subscription, plan })
 → syncBillingRolePlanToOrgs(userId, "pro"):
     orgs = Member.where({ userId, role: { in: ["owner","admin"] } })
     for each orgId:
       Organization.update({ planId: plan.id })
       if primeiro ciclo: runMonthlyCycle(orgId)
```

### Billing-role cria 2ª empresa (caso 2)

```
UI: authClient.organization.create({ name, slug })
 → better-auth cria Organization + Member (role=owner)
 → organizationHooks.afterCreateOrganization({ organization, member })
     sub = Subscription.findFirst({ referenceId: member.userId, status: in ["active","trialing"] })
     if sub:
       Organization.update({ planId: plan.id, starsCycleStart: now })
       runMonthlyCycle(organization.id)
```

### Billing-role cancela (caso 4)

```
Stripe Portal: cancelar
 → webhook customer.subscription.deleted → /api/auth/stripe/webhook
 → Plugin: onSubscriptionCancel({ subscription })
 → syncBillingRolePlanToOrgs(userId, null):
     orgs = Member.where({ userId, role: in ["owner","admin"] })
     for each orgId:
       outroPagante = Member.exists({
         organizationId: orgId,
         role: in ["owner","admin"],
         userId: !=this,
         user.subscriptions: status in ["active","trialing"]
       })
       if not outroPagante:
         Organization.update({ planId: null })
         starsGraceStartedAt = now
```

## Checklist de validação (smoke test manual)

A rodar depois da implementação. Cada item é uma ação separada — passe na ordem:

- [ ] Owner sem plano: `/settings/billing` mostra "GRÁTIS"
- [ ] Owner assina Pro via `/subscription/confirm`: `Organization.planId` da org ativa vira o id do Pro
- [ ] **Admin** assina Pro via `/subscription/confirm`: a org onde ele é admin recebe `planId = pro`
- [ ] Outro owner da mesma org abre `/settings/billing`: vê "PRO"
- [ ] Admin da mesma org abre `/settings/billing`: vê "PRO" + botões de gerenciar habilitados
- [ ] Member da mesma org abre `/settings/billing`: vê "PRO" mas botões "Alterar plano" e "Gerenciar Assinatura" sumidos
- [ ] Moderador da mesma org: idem member
- [ ] Member acessa `/subscription/confirm` diretamente: redirect pra `/home`
- [ ] Member chama `subscription.upgrade()` direto via DevTools: 403 do `authorizeReference`
- [ ] Owner com Pro cria nova empresa: nova org já nasce com `planId = pro`
- [ ] Admin com Pro cria nova empresa: nova org já nasce com `planId = pro` (criador vira owner por default)
- [ ] Owner com Pro tenta sair da empresa: bloqueado com erro claro
- [ ] Admin com Pro tenta sair da empresa: bloqueado também
- [ ] Owner com Pro tenta demover admin que TAMBÉM tem Pro: permitido (outro billing-role cobre)
- [ ] Owner com Pro tenta demover admin que NÃO tem Pro: permitido (não é pagante)
- [ ] Owner tenta demover admin que é o ÚNICO pagante da org: bloqueado (caso 12)
- [ ] Owner com Pro cancela no portal: orgs sem outro pagante voltam a `null`
- [ ] Owner com sub `past_due` (forçar via Stripe CLI): `planId` mantém, `starsGraceStartedAt` é setado
- [ ] Stripe CLI: `stripe trigger customer.subscription.updated` → log de `onSubscriptionUpdate` aparece

## Open questions

Itens em aberto que precisam de decisão antes/durante a implementação:

1. **Caso 11 (2 billing-roles, ambos com plano)** — "highest wins" via `Plan.sortOrder` é o critério certo? Alternativas: primeiro a assinar (`createdAt asc`), maior `priceMonthly`, ou explícito por flag no admin.
2. **Casos 12/14 (mudança de role)** — o plugin `organization` do better-auth expõe `afterUpdateMemberRole`? Se não, plugar via interceptor `auth.api.hooks.before` ou rederivar `planId` em job agendado. Validar na implementação.
3. **Member view de billing** — mostrar nome/email do billing-role que paga? Pode ter implicação de privacy quando há vários billing-roles na mesma org.
4. **Promoção pra admin** — quando user X (com sub ativa) é promovido a admin de uma org existente, propagar plano automaticamente? Default proposto = sim, mas pode confundir o owner que aceitou a promoção. Pensar em UX de aviso.

## Out of scope (decidido)

- Enforcement de `Plan.maxUsers` — **ilimitado por enquanto**, conforme decisão do usuário em 2026-06-02. Implementar quando o time decidir o modelo (block vs. cobrar seat extra vs. overage).
- Migração de dados de subs existentes (não há subs ativas em dev hoje).
- Fluxo de "transferir ownership" como first-class action — só bloquear por enquanto.
- Suporte a `seats` no Stripe (single-quantity subscription).

## Como popular os planos no banco

```bash
pnpm tsx --env-file=.env src/scripts/seed-plans.ts
```

> A flag `--env-file=.env` é necessária — tsx não auto-carrega .env como o Next.js faz no `pnpm dev`. Sem ela, Prisma estoura `SASL: client password must be a string`.

Estado atual do seed (`src/scripts/seed-plans.ts`) — **só pra teste**: Earth + Explore com `stripePriceId` hardcoded apontando pra conta de teste do Stripe. Constellation e a estratégia de env var (`STRIPE_PRICE_<SLUG>`) ficam pra quando subir pra produção.

Idempotente: upsert por `slug` — re-rodar só atualiza campos divergentes. Os valores (preço/stars/benefícios) espelham a landing pública (`plans-public-section.tsx`), então mudar tier deve ser refletido no seed E na landing pra evitar drift.

## Referências

- Doc oficial better-auth Stripe plugin: https://better-auth.com/docs/plugins/stripe
- Plano completo desta sessão: `~/.claude/plans/crie-um-planejamento-para-logical-seal.md`
- CLAUDE.md item 11 (ritual pós-migration) — relevante quando mexer em `auth.ts` (Turbopack pode dropar `/api/auth/stripe/webhook` do índice; touch nos catch-all resolve).
