# trafeGO — correções pendentes e mapa de pagamentos

> Backlog de correções levantado na auditoria de **2026-09-17**, sobre `main` no commit
> `2215387a` (merge do PR #395). Nenhum item abaixo foi aplicado — este documento existe para
> que as correções sejam feitas depois, em PRs próprios.
>
> Complementa [`trafego-overview.md`](trafego-overview.md), que é a fonte de verdade do domínio.
> **Ao corrigir um item aqui, marque o status e registre o PR — não apague o item.** Mesma regra
> de [`seguranca-auditoria-2026-08.md`](seguranca-auditoria-2026-08.md).

---

## 1. Contexto da auditoria

| Métrica | Valor |
| --- | --- |
| Arquivos em `src/features/trafego/` | 122 |
| Procedures em `src/app/router/trafego/` | 22 arquivos |
| Linhas do domínio (feature + router) | ~19.700 |
| Rotas de app | 19 |
| Funções Inngest | 4 eventos + 2 crons |
| Modelos Prisma `Trafego*` | 12 |
| Migrations `*_trafego_*` | 11 |
| `any` no domínio | **0** |
| `tsc --noEmit` | **limpo (exit 0)** |

O domínio está bem construído: caminho único de status (`transitionTrafegoOrder`), webhook
fail-closed, preço sempre recalculado no servidor, hooks organizados pela regra 9. Os itens
abaixo são arestas, não defeitos estruturais.

---

## 2. Mapa de pagamentos (estado atual)

Esta seção documenta o que **existe hoje**. As correções da fatia de pagamentos estão em §4.

### 2.1 Composição do preço

O cliente paga **três parcelas separadas**, nunca somadas num item só — a separação é o que
permite o repasse correto no financeiro e a conversa honesta na landing:

| Parcela | O que é | Fonte |
| --- | --- | --- |
| **Verba** | Vai 100% para o anúncio | escolhida pelo cliente, entre R$ 300 e R$ 500.000 |
| **Taxa de serviço** | Receita da agência, incide **sobre** a verba | faixa em `lib/pricing-tiers.ts` |
| **Setup** | BM (Meta) ou número na API Oficial (WhatsApp) — cobrança única | faixa, zera a partir de R$ 2.501 |
| **Criativos extras** | Acima do incluído em `TrafegoSettings.includedCreatives` | `extraCreativeBrlCents` |

| Faixa de verba | Taxa | Setup |
| --- | --- | --- |
| R$ 300 – R$ 500 | 50% | R$ 500 |
| R$ 501 – R$ 1.000 | 40% | R$ 450 |
| R$ 1.001 – R$ 2.500 | 35% | R$ 400 |
| R$ 2.501 – R$ 5.000 | 30% | Grátis |
| Acima de R$ 5.000 | 25% | Grátis |

`quoteTrafego()` é a **única** função que monta a cotação, e roda no browser (simulador) e no
servidor (checkout) com o mesmo código. O teto de R$ 500.000 existe por aritmética (`Int` do
Postgres estoura em R$ 21.474.836,47 e o total chega lá antes da verba) e por negócio.

### 2.2 Os dois meios de pagamento

```
                        ┌──────────── CARTÃO ────────────┐
POST /api/checkout/trafego                               │
  valida · recalcula cotação · checa políticas e prazo    │
  cria TrafegoPendingPurchase(PENDING)                    │
  cria card no tracking + resposta de briefing ──────────>│ (best-effort)
                                                          ▼
                                      Stripe Checkout Session (até 4 line_items)
                                      metadata { kind:"trafego_order", pendingId }
                                      propagada também para o PaymentIntent
                                                          │
                                      POST /api/trafego/webhook
                                        [STRIPE_TRAFEGO_WEBHOOK_SECRET · fail-closed]
                                        dedupe por event.id (claimStripeEvent)
                                                          ▼
                        ┌──────────────  PIX MANUAL  ─────┼───────────┐
  paymentMethod="PIX"                                     │           │
  gera referência TGP-XXXX · grava pixExpiresAt           │           │
  devolve chave + valor + mensagem pronta pro WhatsApp    │           │
  cliente manda comprovante → equipe abre a aba trafeGO do card       │
  trafego.ops.confirmPix (admin OU participante do tracking)          │
                        └────────────────────────────────┬───────────┘
                                                          ▼
                              markTrafegoPurchasePaid()  ← CAMINHO ÚNICO
                                claim atômico: updateMany com guarda de status
                                  ├ flow="authenticated" → cria o pedido agora
                                  └ flow="public" → signupToken (7 dias) → Inngest
                                                          ▼
                              runTrafegoOrderPostCreation() (fora da transação)
                                card · briefing · financeiro · aviso ao cliente
```

**O ponto central**: Stripe e PIX convergem em `markTrafegoPurchasePaid`
(`server/lib/mark-purchase-paid.ts`). O claim atômico (`updateMany` com guarda de status) é o que
dá idempotência entre os dois — quem chega primeiro ganha, o segundo recebe `already_paid` e não
produz efeito nenhum. Cartão aprovado **depois** de um PIX já confirmado dispara notificação de
cobrança em duplicidade para os admins.

### 2.3 Eventos do webhook

| Evento | Tratamento |
| --- | --- |
| `checkout.session.completed` | Confirma, **se** `payment_status === "paid"` |
| `payment_intent.succeeded` | Fallback e métodos assíncronos; resolve `pendingId` pelo metadata ou pelo `stripePaymentIntentId` |
| `checkout.session.expired` | `PENDING → EXPIRED` |
| `charge.refunded` | Só reembolso **total** revoga (`REFUNDED` + transição do pedido); parcial só loga |
| `charge.dispute.created` | Apenas registra — disputa não revoga acesso |

Claim do Stripe aceita **só `PENDING`**. Claim do PIX aceita `PENDING` **e** `EXPIRED` — quem paga
atrasado tem o dinheiro na conta do mesmo jeito.

### 2.4 Divergência de valor

`amountMismatch` marca quando o valor recebido difere do contratado (cupom, ajuste manual, PIX a
menor). O sistema **nunca reescala a verba em silêncio** — sinaliza para conferência humana, e o
admin filtra por essa flag em `/admin/trafego`. Com cupom habilitado e sem rastreio do desconto,
**toda** compra com cupom cai aqui — ver P-9.

### 2.5 Reflexo no financeiro

`createTrafegoSaleSideEffects` cria **dois** `PaymentEntry` na org da agência, idempotentes por
`(organizationId, type, documentNumber = código do pedido)`:

| Lançamento | Tipo | Status | Valor |
| --- | --- | --- | --- |
| Receita | `RECEIVABLE` | `PAID` | taxa de serviço + setup |
| Repasse | `PAYABLE` | `PENDING` | verba de tráfego |

Os valores são os **contratados**, sempre — o sistema não sabe quanto o Stripe realmente cobrou.
Com cupom habilitado, isso vira lançamento falso: ver P-9.

Somar as duas num lançamento só inflaria o faturamento — a verba não é receita, é dinheiro em
trânsito para a plataforma de anúncios.

### 2.6 Arquivos da fatia de pagamentos

```
src/features/trafego/lib/pricing-tiers.ts        faixas, clamp, quoteTrafego — fonte de verdade
src/features/trafego/lib/pricing.ts              formatação + STRIPE_MIN_BRL_CENTS
src/features/trafego/lib/pix.ts                  referência TGP-XXXX, normalização, mensagem
src/features/trafego/server/lib/mark-purchase-paid.ts     caminho único de confirmação
src/features/trafego/server/lib/sale-side-effects.ts      PaymentEntry (receita + repasse)
src/features/trafego/server/lib/create-order-from-purchase.ts   snapshot do preço no pedido
src/app/api/checkout/trafego/route.ts            checkout público (cartão e PIX)
src/app/api/trafego/webhook/route.ts             webhook dedicado, fail-closed
src/app/router/trafego/ops/confirm-pix.ts        "Confirmar PIX" da equipe
src/app/router/trafego/ops/list-pending-pix.ts   fila de PIX aguardando comprovante
src/app/router/trafego/public/get-pending-purchase.ts   polling da tela de sucesso
src/app/router/trafego/public/redeem-purchase.ts        resgate (auth + e-mail conferido)
src/inngest/functions/crons/trafego-pix-pending-sweep.ts   PIX vencido → EXPIRED
src/lib/email/trafego-purchase-confirmation.tsx  e-mail com o link de ativação
```

---

## 3. Correções — estrutura e documentação

### E-1 · Documento do domínio desatualizado (Fase E ausente) — **alta**

`docs/trafego-overview.md` para na Fase D da spec 0009. A migration
`20260916090000_trafego_fase_e` e o PR #394 ("complete client campaign flow") entregaram criativos
extras cobrados no checkout, `materialsProfileLink`, `includedCreatives` e `extraCreativeBrlCents`
— nada disso está no documento. O cabeçalho ainda cita `SCHEMA_VERSION` `v61-trafego-operacao-kanban`;
o valor real em `src/lib/prisma.ts` é `v74-astro-bot-finance`. O status "migrations pendentes de
aplicação" também precisa ser reconferido contra produção.

- [ ] Adicionar linha da **Fase E** ao roadmap e ao changelog
- [ ] Corrigir `SCHEMA_VERSION` e o status das migrations no cabeçalho
- [ ] Documentar criativos extras na seção de cobrança (§1 do overview)

### E-2 · Duas tabelas mortas no schema — **média**

`TrafegoCreativeTopUp` (`prisma/schema.prisma:8520`) e `TrafegoInfoTipSeen` (`:8540`) foram criadas
na migration da Fase E e têm **zero referências** em todo o `src/` — nenhuma procedure, nenhum
componente, nenhum hook. São tabelas em produção que ninguém escreve nem lê.

Decidir entre as duas saídas, sem deixar no limbo:

- [ ] **Ou** implementar o que motivou cada uma (compra avulsa de criativo extra depois do
      checkout; dispensa persistente das dicas do painel)
- [ ] **Ou** remover com migration de `DROP TABLE` e registrar a decisão no changelog

### E-3 · Recuperação de carrinho: colunas sem cron — **média**

`TrafegoPendingPurchase` tem `lastReminderSentAt`, `lastReminderStage` (`:8218`) e o status
`ABANDONED`, mas **não existe cron de recuperação** para o trafeGO. O NASA Route tem o seu
(`src/inngest/functions/crons/nasa-route-cart-recovery.ts`, com estágios D+1/D+3/D+7/D+15 e
`ABANDONED` após 30 dias). O roadmap do overview marca o item como ⬜.

- [ ] Criar `trafego-cart-recovery.ts` espelhando o do NASA Route, ou
- [ ] Declarar o item fora de escopo e remover as colunas

> Atenção ao desenhar: o carrinho do trafeGO nasce com **card no CRM** desde o "Continuar". O
> lembrete precisa conversar com o card em "Aguardando pagamento", não duplicá-lo.

### E-4 · Violação da regra 9 (chamada oRPC fora de hook) — **baixa**

[`activate-form.tsx:103`](../src/app/(public)/trafego/ativar/[token]/activate-form.tsx) chama
`orpcClient.trafego.redeemPurchase(...)` direto, enquanto o hook `useRedeemTrafegoPurchase`
(`hooks/use-trafego-purchase.ts:72`) existe e está **órfão** — nenhum consumidor.

- [ ] Migrar o formulário para o hook, ou remover o hook órfão e registrar por que aqui o
      `client` direto é o caminho certo (a chamada acontece dentro de um fluxo de `signUp`)

> A outra ocorrência de `import { orpc }` fora de hook, em `components/preview/preview-provider.tsx`,
> é legítima: usa `orpc` apenas para montar query keys ao semear o cache. Não mexer.

### E-5 · `trafego-landing.tsx` com 1.152 linhas e 26 `useState` — **média**

O wizard inteiro (7 telas, rascunhos de negócio/prazo/contato, compliance, simulador, PIX) vive num
componente só. Já custou um hotfix de build no PR #391 (`useSearchParams` sem Suspense).

- [ ] Extrair o estado do wizard para `useReducer` ou store dedicada
- [ ] Manter as telas em `components/public/wizard/` como já estão — o problema é o estado, não o markup

### E-6 · Componentes de admin fora da feature — **baixa**

`src/features/admin/components/trafego/` (`order-detail`, `orders-table`, `public-link-card` e a
pasta `settings/`) importa hooks, libs e componentes de
`@/features/trafego`. A regra 3 do CLAUDE.md diz que código de domínio mora na pasta do domínio.

- [ ] Mover para `src/features/trafego/components/admin/`, deixando em `features/admin` apenas o
      que for realmente transversal (entrada na sidebar)

### E-7 · Fixtures de preview no bundle de produção — **baixa / investigar**

`lib/preview-fixtures.ts` tem 584 linhas de dados fictícios. O layout de `/trafego/preview/*` chama
`notFound()` quando `NODE_ENV === "production"`, mas isso é **runtime**: as rotas continuam sendo
compiladas e o chunk do preview pode ir para o build.

- [ ] Confirmar no output do build se as fixtures saem do bundle de produção
- [ ] Se não saírem, mover o preview para trás de um flag de build ou para um segmento excluído

---

## 4. Correções — pagamentos

### P-1 · `claimPixReference` tem corrida que vira 500 no checkout — **alta**

[`route.ts:523`](../src/app/api/checkout/trafego/route.ts) sorteia a referência, checa com `count()`
e devolve. Entre o `count` e o `update` da linha 335 não há atomicidade, e `pixReference` é
`@unique` no schema. Duas requisições simultâneas que sorteiem o mesmo código fazem a segunda
estourar `P2002` — e esse `update` **não está em try/catch**.

**Falha concreta**: dois clientes clicam em "Pagar com PIX" no mesmo segundo, o sorteio colide
(1 em ~1M por tentativa, 32⁴ combinações), o segundo recebe **500** depois de o sistema já ter
criado a `TrafegoPendingPurchase` e o card no CRM. Sobra um card órfão em "Aguardando pagamento" e
um cliente que não viu a chave PIX.

- [ ] Trocar o `count` + `update` por um laço de `update` com captura de `P2002`, ou por
      `INSERT ... ON CONFLICT`
- [ ] Envolver o `update` da linha 335 em try/catch que cancele a pendência e devolva erro tratado
- [ ] Revisar o fallback `TGP-${pendingId.slice(-6)}`: tem 6 caracteres contra 4 do formato normal
      e usa alfabeto diferente (aceita `0`/`1`/`I`/`O`, justamente o que o alfabeto evita porque o
      cliente dita a referência por WhatsApp)

### P-2 · `/api/checkout/trafego` sem rate limit — **alta**

O endpoint é **público, sem auth**, e cada chamada cria uma `TrafegoPendingPurchase`, um **card no
tracking de operação**, uma **resposta de formulário** e uma **Stripe Checkout Session**. Não há
limite por IP — `src/lib/rate-limit.ts` existe e já é usado em `router/trafego/public/verification.ts`
e em `/api/trafego/assistant`, mas não aqui.

**Falha concreta**: um script consegue encher o kanban da operação de cards falsos e gerar
centenas de sessões no Stripe. A idempotência de 30 minutos só protege repetições com **o mesmo**
`(email, verba, objetivo, flow)` — variar o e-mail derrota a janela.

- [ ] Aplicar `takeRateLimit` por IP no `POST /api/checkout/trafego`
- [ ] Avaliar um segundo limite por e-mail, mais frouxo
- [ ] Considerar só criar o card depois de a pendência ter sessão do Stripe ou referência PIX

### P-3 · `getPendingPurchase` devolve dados pessoais por `pendingId` — **média**

[`get-pending-purchase.ts:70`](../src/app/router/trafego/public/get-pending-purchase.ts) é público e,
dado um `pendingId`, devolve e-mail, valores, plataforma, objetivo **e o `signupToken`**. O
comentário no arquivo afirma que o token só vai para quem consultou pelo id do próprio pending, mas
o `select` devolve o campo nos dois caminhos, sem condicional.

O risco é **contido**, e vale registrar por quê: `redeemPurchase` exige sessão autenticada **e** que
o e-mail da sessão bata com o da compra, então vazar o token não entrega a compra a ninguém. O que
vaza de fato é **PII** (e-mail do comprador, valor pago) para quem tiver o `pendingId` — que é um
cuid, não um segredo criptográfico, e trafega na query string de `/trafego/sucesso`.

- [ ] Devolver `signupToken` apenas quando a consulta veio **por** `signupToken`, ou quando o
      `paidAt` já existe e a requisição tem o `session_id` do Stripe
- [ ] Mascarar o e-mail na resposta (`j***@dominio.com`) — a tela de sucesso não precisa do valor inteiro
- [ ] Aplicar rate limit por IP, como em `verification.ts`

### P-4 · Reembolso parcial não tem tratamento nem fila — **média**

O webhook loga `reembolso parcial em <id> — nenhuma ação automática` e segue. Não existe
notificação ao admin, flag no pedido, nem `PaymentEntry` de estorno. O dinheiro volta ao cliente e o
financeiro da agência continua mostrando a receita cheia.

- [ ] Criar `UserNotification` para os admins no reembolso parcial (mesmo padrão de
      `notifyDuplicatePayment`)
- [ ] Registrar um `PaymentEntry` de ajuste, ou ao menos um `TrafegoOrderEvent` interno com o valor
- [ ] Decidir e documentar: reembolso parcial reduz a verba da campanha ou sai da taxa?

### P-5 · Reembolso total não reverte o financeiro — **média**

`revokeTrafegoPurchase` marca a compra como `REFUNDED` e transiciona o pedido, mas os dois
`PaymentEntry` criados por `createTrafegoSaleSideEffects` ficam como estavam: a receita segue
`PAID` e o repasse segue `PENDING`. O faturamento da agência fica inflado pelo valor de uma venda
que foi devolvida.

- [ ] Ao revogar, baixar o `RECEIVABLE` (estorno) e cancelar o `PAYABLE` do repasse
- [ ] Manter a idempotência por `documentNumber` ao criar os lançamentos de estorno

### P-6 · `charge.dispute.created` só escreve no console — **baixa**

Disputa (chargeback) é o evento mais caro do fluxo e hoje não gera notificação, evento na timeline
nem flag no pedido. Quem não estiver lendo o log do servidor descobre pelo extrato.

- [ ] Notificar admins e criar `TrafegoOrderEvent` interno
- [ ] Decidir se a campanha pausa automaticamente enquanto a disputa corre

### P-7 · `computeTrafegoPrice` é código legado ainda exportado — **baixa**

`lib/pricing.ts` mantém `computeTrafegoPrice`, do modelo antigo de planos fixos com
`serviceFeePercent`/`serviceFeeBrlCents`. O checkout usa `quoteTrafego` de `pricing-tiers.ts`. Ter
duas funções de preço no mesmo domínio convida alguém a chamar a errada.

- [ ] Conferir se `computeTrafegoPrice` ainda tem consumidor (planos fixos do `TrafegoPlan`)
- [ ] Se não tiver, remover; se tiver, renomear para `computeLegacyPlanPrice` e comentar o escopo

### P-8 · Sem cobrança avulsa depois do checkout — **média / produto**

Hoje só existe **um** momento de cobrança: o checkout inicial. Criativos extras precisam ser
decididos antes de pagar (`desiredCreativeCount`), e não há caminho para o cliente aumentar a verba,
renovar a campanha ou comprar criativo depois. `TrafegoCreativeTopUp` (§E-2) foi criada exatamente
para isso e ficou vazia.

- [ ] Decidir com o dono do produto se o top-up entra
- [ ] Se entrar: rota de checkout própria, evento no webhook (`kind: "trafego_topup"`), lançamento
      no financeiro e reflexo no limite de criativos do painel

### P-9 · Cupom habilitado sem rastreio do desconto — **alta** 🔴

**Estado atual (decisão consciente, não esquecimento)**: `allow_promotion_codes: true` está em
produção para permitir teste ponta a ponta e cortesia. O desconto **não é gravado em lugar nenhum**.

Duas consequências, ambas ativas hoje:

1. **Financeiro recebe lançamento falso.** `createTrafegoSaleSideEffects` lança pelos valores
   contratados. Um pedido de R$ 1.850 com cupom de 100% cria **R$ 850 de receita marcada como
   recebida** e **R$ 1.000 de verba a pagar** na org da agência, para R$ 0 em caixa.
2. **`amountMismatch` marcado em toda compra com cupom.** A flag de cobrança divergente deixa de
   ser sinal e vira ruído.

**Regra operacional enquanto isto não for resolvido** — vale como contrato, não como sugestão:

- Cupom **só** em pedido de teste. Nada de cupom comercial (ex.: 20% numa campanha real).
- Depois de cada teste: cancelar o pedido e **apagar os dois `PaymentEntry`** da org da agência
  (`documentNumber` = código do pedido).

**A correção** está desenhada por completo na spec
[`0010`](../specs/trafego/0010-trafego-checkout-cupom.md) §5, com a tabela de alocação já verificada
numericamente. Foi implementada e revertida nesta mesma sessão: a migration não se justificava
apenas para destravar o teste. Três caminhos possíveis, do mais barato ao mais completo:

- [ ] **Mínimo** — não deixar cupom cair no financeiro: pular `createTrafegoSaleSideEffects` quando
      `session.amount_total` for 0. Sem migration, resolve o pior sintoma
- [ ] **Sem migration** — ler `total_details.amount_discount` do Stripe (via `stripeSessionId` já
      gravado) na hora de lançar, e alocar pela regra taxa → setup → extras → verba. Lançamentos
      corretos, sem registro histórico
- [ ] **Completo (spec 0010 Fase B)** — colunas `discountBrlCents` e `promotionCode` na pendência e
      no pedido, alocação, correção do `amountMismatch`, evento interno quando o cupom atinge a
      verba, e bloco do cupom no admin

> Se o cupom deixar de ser só para teste e virar ferramenta comercial, este item passa a ser
> bloqueante — não dá para emitir desconto real com o financeiro registrando valor cheio.

---

## 5. Checklist consolidado

| Id | Item | Peso | Área | Status |
| --- | --- | --- | --- | --- |
| P-9 | **Cupom habilitado sem rastreio do desconto** (financeiro falso) | Alta | Pagamentos | ⬜ |
| P-1 | Corrida em `claimPixReference` vira 500 | Alta | Pagamentos | ⬜ |
| P-2 | Checkout público sem rate limit | Alta | Pagamentos | ⬜ |
| E-1 | Overview sem a Fase E; `SCHEMA_VERSION` errado | Alta | Docs | ⬜ |
| P-3 | `getPendingPurchase` expõe PII e `signupToken` | Média | Pagamentos | ⬜ |
| P-4 | Reembolso parcial sem tratamento | Média | Pagamentos | ⬜ |
| P-5 | Reembolso total não reverte o financeiro | Média | Pagamentos | ⬜ |
| P-8 | Sem cobrança avulsa pós-checkout | Média | Produto | ⬜ |
| E-2 | `TrafegoCreativeTopUp` e `TrafegoInfoTipSeen` mortas | Média | Schema | ⬜ |
| E-3 | Recuperação de carrinho sem cron | Média | Automação | ⬜ |
| E-5 | `trafego-landing.tsx` com 1.152 linhas / 26 `useState` | Média | Front | ⬜ |
| P-6 | Disputa só no console | Baixa | Pagamentos | ⬜ |
| P-7 | `computeTrafegoPrice` legado | Baixa | Pagamentos | ⬜ |
| E-4 | Regra 9 em `activate-form.tsx` + hook órfão | Baixa | Front | ⬜ |
| E-6 | Componentes admin fora da feature | Baixa | Arquitetura | ⬜ |
| E-7 | Fixtures de preview no bundle | Baixa | Build | ⬜ |

### Ordem sugerida

1. **PR 1 — pagamentos, risco de produção**: P-9, P-1, P-2, P-3. São os que produzem falha,
   contaminação de dado ou exposição com o sistema no ar. P-9 primeiro: é o único que já está
   sujando dado de produção a cada uso.
2. **PR 2 — estorno e conciliação**: P-4, P-5, P-6. Mexem no mesmo arquivo (webhook) e no mesmo
   conceito (reverter a venda).
3. **PR 3 — limpeza de schema**: E-2 e E-3, com a decisão de produto tomada antes. Exige migration.
4. **PR 4 — documentação**: E-1 (pode ir junto com qualquer um dos anteriores).
5. **Depois, sem pressa**: E-5, E-6, E-4, E-7, P-7.

> P-8 é decisão de produto, não correção. Só entra na fila depois de definido.

---

## 6. Changelog

| Data | Mudança |
| --- | --- |
| 2026-09-17 | Documento criado. Auditoria de estrutura e de pagamentos sobre `2215387a`: 15 itens (7 de estrutura, 8 de pagamentos), nenhum aplicado. |
| 2026-09-17 | Cupom habilitado no checkout (`allow_promotion_codes: true`, spec [0010](../specs/trafego/0010-trafego-checkout-cupom.md) Fase A). O rastreio do desconto (Fase B) foi implementado e **revertido** por decisão do dono — a migration não se justificava só para destravar teste. Registrado como **P-9**, com a regra operacional de uso até lá. **Nenhum item deste backlog foi resolvido**; P-2 (rate limit) ficou mais relevante, já que o checkout público agora aceita códigos. |
