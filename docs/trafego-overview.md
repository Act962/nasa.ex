# trafeGO — self-service de tráfego pago e campanhas

> Documento de referência do domínio `trafego`. Status: **Fase 1 implementada (2026-08-31)**.
> Spec: [`specs/trafego/0008-trafego-self-service.md`](../specs/trafego/0008-trafego-self-service.md).
>
> **Regra de manutenção**: ao mexer em `src/features/trafego/`, `src/app/router/trafego/`,
> `src/app/(public)/trafego/`, `src/app/(platform)/(tracking)/trafego/`,
> `src/app/(admin)/admin/trafego/`, nos endpoints `/api/checkout/trafego` e
> `/api/trafego/webhook`, ou nos modelos `Trafego*` do schema, **atualize este documento na
> mesma sessão**. Espelha as regras 10 (NASA Route), 14 (WhatsApp Oficial) e 19 (arquitetura).

---

## 1. O que é

Produto self-service para PMEs contratarem tráfego pago sem passar por agência. O cliente
percorre sozinho: escolhe o canal, o tipo de campanha, o objetivo e o plano, paga, cria a
conta, envia criativos e copy, e clica em "Ativar". A equipe NASA executa e vai atualizando o
status; o cliente acompanha andamento e desempenho pelo painel.

**Modelo de cobrança**: pagamento único por campanha. O preço é composto por **verba de
tráfego** (vai para o anúncio) + **taxa de serviço** (receita da NASA, 50% por padrão). As duas
parcelas aparecem separadas para o cliente — na landing, no Stripe e no e-mail.

## 2. Decisões travadas

| Decisão | Escolha | Porquê |
| --- | --- | --- |
| Catálogo v1 | Meta Ads + WhatsApp API Oficial | Google Ads não tem client HTTP, model nem UI no projeto |
| Cobrança | Pagamento único (Stripe Checkout) | Reusa o eixo `PendingCoursePurchase`, que já funciona anônimo |
| Execução | **Manual pela equipe** | Verba é dinheiro real em conta da agência; clique de cliente não publica anúncio |
| Conta do cliente | Organization própria com `appScope="trafego"` | Reusa auth/org/permissões; sidebar restrita ao app |
| Nome do pedido | `TrafegoOrder`, nunca "campanha" | "Campanha" já nomeia `Broadcast`, `MetaAdCampaign` e `NasaCampaignPlanner` |
| Timeline | Eventos append-only (`TrafegoOrderEvent`) | O fluxo tem voltas (ajustes); coluna `*At` por estágio perderia a segunda passagem |
| Webhook | Endpoint próprio (`/api/trafego/webhook`) | Um throw derruba o endpoint inteiro e o Stripe reentrega tudo — mesmo motivo de `/api/stars/webhook` ser separado |

### Não-objetivos declarados

Google Ads · publicação automática no Meta · criação automática de `Broadcast` · assinatura
recorrente · PIX/boleto (o webhook Asaas não valida assinatura) · barreira server-side por app.

## 3. Fluxo ponta a ponta

```
/trafego (público, sem auth)
  wizard: canal → tipo → objetivo → briefing → plano → contato
  └─ POST /api/checkout/trafego
       cria TrafegoPendingPurchase (PENDING) + Stripe Session com 2 line_items
       idempotência de 30 min por (email, planId, objective)
  └─ Stripe Checkout
  └─ /trafego/sucesso?token=<pendingId>   (polling 2s × 30)

POST /api/trafego/webhook   [STRIPE_TRAFEGO_WEBHOOK_SECRET]
  dedupe por event.id (ProcessedStripeEvent, source="trafego")
  claim atômico PENDING → PAID
  gera signupToken (TTL 7 dias) → Inngest `trafego/purchase.paid` → e-mail Resend

/trafego/ativar/<signupToken>
  authClient.signUp.email  →  trafego.redeemPurchase  →  setActive
  $transaction: Organization(appScope="trafego") + Member(owner) + TrafegoOrder(ONBOARDING)
  fora da tx: PaymentEntry (receita da taxa + repasse da verba) e Lead no CRM

/trafego/painel/<orderId>
  Materiais (criativos + copy + briefing) → "Ativar campanha"
  └─ claim atômico → REQUESTED → Inngest `trafego/order.requested` → notifica a equipe

/admin/trafego
  fila → troca de status → vincula metaCampaignExternalId ou broadcastId
```

## 4. Modelo de dados

| Model | Papel |
| --- | --- |
| `TrafegoPlan` | Catálogo público. Guarda `adBudgetBrlCents` + regra de taxa; o total é derivado por `computeTrafegoPrice()` |
| `TrafegoPendingPurchase` | Compra antes de existir conta. Espelha `PendingCoursePurchase` |
| `TrafegoOrder` | A campanha contratada. Carrega snapshot de catálogo e preço |
| `TrafegoOrderEvent` | Timeline append-only; `isClientVisible` separa nota interna |
| `TrafegoCreative` | Criativo enviado. Guarda a **key** do R2, nunca a URL |
| `TrafegoCopy` | Variações de texto; `isSelected` marca o que vai veicular |
| `TrafegoSupportMessage` | Thread de suporte por pedido |
| `TrafegoSettings` | Singleton: org da agência, tracking de vendas, taxa padrão |

Campo novo em `Organization`: `appScope` (`"trafego"` ou `null`).

### Dois pontos que causam bug silencioso

1. **`metricsOrganizationId`** — `MetaAdsKpiSnapshot` é chaveado pela org que detém a
   `PlatformIntegration(META)`, ou seja, a da **agência**, não a do cliente. Sem esse campo o
   painel do cliente volta vazio. É preenchido a partir de `TrafegoSettings.agencyOrganizationId`.
2. **`position`, não `order`** — em `TrafegoCreative`/`TrafegoCopy`, o campo de ordenação não pode
   se chamar `order`: colidiria com a relação de mesmo nome.

## 5. Arquivos

```
specs/trafego/0008-trafego-self-service.md      spec completa (casos de borda enumerados)

src/features/trafego/
├── lib/          pricing.ts · order-status.ts · catalog-labels.ts
├── schema/       trafego-schemas.ts
├── hooks/        use-trafego-plans · -purchase · -orders · -support · -admin
├── server/lib/   create-order-from-purchase · begin-trafego-activation
│                 sale-side-effects · assert-order-editable · order-code
└── components/
    ├── public/   trafego-landing (wizard) · price-breakdown · success-polling
    ├── panel/    orders-list · order-detail · creatives-manager · copies-manager
    │             briefing-form · status-timeline · performance-view · support-thread
    └── trafego-scope-guard.tsx

src/app/router/trafego/       public/ (3) · painel (7) · admin/ (plans, orders, settings)
src/app/api/checkout/trafego/ endpoint público de checkout
src/app/api/trafego/webhook/  webhook dedicado
src/app/(public)/trafego/     landing · sucesso · ativar/[token]
src/app/(platform)/(tracking)/trafego/painel/
src/app/(admin)/admin/trafego/
src/inngest/functions/trafego/ purchase-paid · order-requested
src/lib/email/trafego-purchase-confirmation.tsx
src/features/admin/components/trafego/ orders-table · order-detail · plans-manager · settings-form
```

## 6. Configuração necessária

| Item | Onde | Sem isso |
| --- | --- | --- |
| `STRIPE_TRAFEGO_WEBHOOK_SECRET` | `.env.local` + Stripe Dashboard | Webhook recusa toda entrega |
| Planos | `/admin/trafego/planos` | Catálogo público vazio |
| Org da agência | `/admin/trafego/planos` → Ajustes | Sem lançamento financeiro e sem métricas do Meta |
| Tracking de vendas | idem | Venda não vira lead no CRM |

Eventos a configurar no endpoint do Stripe: `checkout.session.completed`,
`payment_intent.succeeded`, `checkout.session.expired`, `charge.refunded`,
`charge.dispute.created`.

## 7. Roadmap

| Fase | Escopo | Status |
| --- | --- | --- |
| 1 | Venda ponta a ponta: catálogo, wizard, checkout, webhook, ativação de conta, painel, fila interna | ✅ |
| 2 | Materiais: criativos, copies, briefing, botão Ativar | ✅ |
| 3 | Desempenho: vínculo de campanha e KPIs unificados | ✅ |
| 4 | Suporte e retenção: thread ✅ · notificações ✅ · recuperação de carrinho ⬜ · recompra ⬜ |  🚧 |
| 5 | Criação automatizada no Meta · Embedded Signup do número do cliente · `OrgPermission` como barreira real | ⬜ |

## 8. Changelog

| Data | Mudança |
| --- | --- |
| 2026-08-31 | Fases 1–3 implementadas; thread de suporte e notificação da equipe (parte da 4). |
