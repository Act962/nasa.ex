# 0010 — Cupom no checkout do trafeGO

| Campo | Valor |
| --- | --- |
| Status | **rascunho** — só a Fase A foi para produção |
| Domínio | `trafego` |
| Peso | completa (mexe com dinheiro) |
| Autor | João Gabriel |
| Data | 2026-09-17 |
| Specs relacionadas | [0008](0008-trafego-self-service.md) (venda), [0009](0009-trafego-operacao-inteligencia.md) (operação) |

> **Leia isto antes de qualquer coisa.** Desta spec, **só a Fase A está no código**: o campo de
> cupom aparece no Checkout e nada mais. A Fase B (rastreio do desconto) está **desenhada e não
> implementada** — é proposta, não descrição do sistema. Acompanhamento em
> [`docs/trafego-correcoes-pendentes.md`](../../docs/trafego-correcoes-pendentes.md) §P-9.

---

## 1. Contexto

O checkout subia a sessão do Stripe com `allow_promotion_codes: false`, impedindo teste ponta a
ponta em produção sem cobrar de verdade.

A trava tinha motivo. A venda é decomposta em até quatro `line_items` (verba, taxa de serviço,
setup, criativos extras) e o Stripe aplica o cupom **sobre a sessão inteira**, sem dizer qual item
absorveu o desconto. Sem uma regra de alocação e sem gravar o valor descontado, dois problemas
aparecem:

1. **O financeiro mente.** `createTrafegoSaleSideEffects` lança receita (taxa + setup) e repasse
   (verba) pelos valores contratados. Com cupom, a agência registra faturamento que não entrou e um
   repasse de verba sem lastro.
2. **Toda compra com cupom vira `amountMismatch`.** A flag existe para cobrança divergente que
   precisa de conferência humana. Cupom legítimo dispara o alarme e o sinal se perde no ruído.

> O comentário antigo no código citava "spec 0008 §CB-14". CB-14 trata de falha ao criar a sessão
> do Stripe, não de cupom — a citação estava errada.

## 2. Objetivo

Permitir cupom no Checkout do trafeGO sem que o desconto corrompa o financeiro nem o sinal de
divergência de valor.

## 3. Não-objetivos

- **Cupom no PIX.** É manual e não passa pelo Stripe.
- **Cupom restrito a um `line_item`.** O Stripe restringe por *produto*, e nossos itens são
  `price_data` inline sem `product` id. Exigiria criar Products reais.
- **Gestão de cupons no admin do NASA.** Cupons vivem no Dashboard do Stripe.
- **Recalcular a verba da campanha** quando o cupom a reduz. A decisão é humana.

---

## 4. Fase A — habilitar (✅ em produção)

Uma linha em `src/app/api/checkout/trafego/route.ts`:

```ts
allow_promotion_codes: true,
```

**O que isso entrega**: o campo "Adicionar código promocional" aparece no Checkout, e um cupom de
100% conclui a compra. `checkout.session.completed` dispara para sessão de total zero, com
`payment_status: "paid"` e **sem PaymentIntent** — o handler já tolera `payment_intent` nulo, então
a confirmação, o pedido, o card e os avisos funcionam.

**O que isso NÃO entrega** — e é preciso conviver com isso conscientemente:

| Efeito | Consequência prática |
| --- | --- |
| Desconto não é gravado | Não existe registro de que houve cupom, nem de quanto |
| `amountMismatch` marcado sempre | Pedido com cupom aparece no admin como cobrança divergente |
| Financeiro pelos valores contratados | Pedido de teste de R$ 1.850 com 100% off cria **R$ 850 de receita recebida** e **R$ 1.000 de verba a pagar** na org da agência, para R$ 0 em caixa |

**Regra de uso enquanto a Fase B não existir**: cupom só em pedido de teste, e os dois
`PaymentEntry` gerados devem ser apagados à mão depois. Um cupom comercial de verdade (ex.: 20%
numa campanha real) **não** deve ser emitido nesse estado.

---

## 5. Fase B — rastrear o desconto (⬜ proposta)

### 5.1 Regra de alocação — o núcleo da proposta

Uma função pura em `lib/pricing-tiers.ts` distribuiria o desconto nesta ordem:

```
taxa de serviço → setup → criativos extras → verba do anúncio
```

**Por que essa ordem**: desconto em cima da margem da agência não muda nada do que foi prometido ao
cliente. Desconto na verba significa menos dinheiro para investir no anúncio — muda a entrega. Por
isso a verba é a última a ser tocada, e quando é tocada o sistema **avisa a equipe** em vez de
seguir em silêncio.

Verificação numérica do desenho, com verba de R$ 1.000 (faixa de 40%, setup R$ 450 → total
R$ 1.850):

| Cupom | Taxa | Setup | Verba | Receita | Avisa? |
| --- | --- | --- | --- | --- | --- |
| R$ 200 | 200 | 450 | **1.000** | 650 | não |
| R$ 600 | 0 | 250 | **1.000** | 250 | não |
| R$ 1.000 | 0 | 0 | 850 | 0 | **sim** |
| 100% | 0 | 0 | 0 | 0 | **sim** |

Em todos os casos a soma das parcelas mais o desconto fecha o contratado, e cupom acima do total é
travado sem gerar valor negativo.

### 5.2 Persistência

Duas colunas aditivas em `TrafegoPendingPurchase` **e** `TrafegoOrder`:

| Coluna | Papel |
| --- | --- |
| `discountBrlCents` (`Int @default(0)`) | Valor do desconto. Tem justificativa funcional: é o que distingue "R$ 0 porque houve cupom" de "R$ 0 porque algo falhou" |
| `promotionCode` (`String?`) | Código legível. **Só conveniência** — nada funcional depende dele |

O contratado **não** é reescrito: é ele que diz o que foi vendido, e o desconto explica a diferença
entre ele e o que entrou em caixa.

> Alternativa sem migration, se o custo do schema não se justificar: ler o desconto do Stripe na
> hora do lançamento, via `stripeSessionId` já gravado no pedido. Lançamentos ficam corretos, mas
> não há registro histórico — responder "por que a receita deste pedido foi R$ 0?" passa a exigir
> consulta ao Stripe.

### 5.3 Leitura do desconto no webhook

`checkout.session.completed` traz `total_details.amount_discount`. O código legível exige
`promotionCodes.retrieve` — `session.discounts` só carrega ids; best-effort, sem travar a compra.

`payment_intent.succeeded` (fallback) **não** carrega o cupom. Nesse caminho seria preciso reler a
sessão a partir do `stripeSessionId`. Sem isso, compra com cupom confirmada pelo fallback viraria
falsa divergência.

### 5.4 Divergência e financeiro

O esperado passa a ser `amountBrlCents − discountBrlCents`. Os dois `PaymentEntry` passam a usar os
valores **financiados**; parcela zerada pelo cupom não gera lançamento. Quando o cupom atinge a
verba, um `TrafegoOrderEvent` interno registra contratado, disponível e cupom.

## 6. Casos de borda

| # | Situação | Fase A (hoje) | Fase B (proposta) |
| --- | --- | --- | --- |
| CB-1 | Cupom de 100% | Compra confirma; financeiro sujo | Nenhum lançamento; evento interno |
| CB-2 | Cupom < taxa de serviço | Financeiro pelo contratado | Absorvido pela taxa; repasse intacto |
| CB-3 | Cupom entre taxa e taxa+setup+extras | idem | Consome taxa, setup, extras |
| CB-4 | Cupom > taxa+setup+extras | idem | Corta a verba + avisa a equipe |
| CB-5 | Confirmação via `payment_intent.succeeded` | Sem desconto conhecido | Relê a sessão |
| CB-6 | `promotionCodes.retrieve` falha | n/a | `promotionCode: null`, desconto gravado |
| CB-7 | Cupom + valor divergente | Indistinguível | Divergência sobre o valor já descontado |
| CB-8 | Compra no PIX | Sem cupom | Sem cupom |
| CB-9 | Pedido anterior à migration | n/a | `discountBrlCents` 0 por default |

## 7. Critérios de aceite

**Fase A:**

- **CA-1** ✅ — Com `allow_promotion_codes: true`, o campo de código promocional aparece no Checkout.
- **CA-2** ✅ — Cupom de 100% conclui a sessão, o webhook confirma e o cliente recebe o link de
  ativação, sem PaymentIntent.

**Fase B (a verificar quando for implementada):**

- **CA-3** ⬜ — Compra com cupom não é marcada `amountMismatch` quando o recebido bate com
  `contratado − desconto`.
- **CA-4** ⬜ — Cupom que cobre só a taxa deixa o `PAYABLE` da verba pelo valor cheio.
- **CA-5** ⬜ — Cupom de 100% não cria nenhum `PaymentEntry` e gera evento interno.
- **CA-6** ⬜ — `discountBrlCents` e `promotionCode` são copiados da pendência para o pedido.
- **CA-7** ⬜ — O admin mostra cupom, desconto e total já descontado.

> Regra 17 do CLAUDE.md pede um teste por critério citando o id. O projeto ainda não tem runner
> instalado (deriva conhecida, item 20). CA-1 e CA-2 foram verificados por leitura e pelos docs do
> Stripe; a tabela de alocação da Fase B foi verificada numericamente sobre a implementação de
> referência, antes de ser revertida.

## 8. Operação — criar o cupom de teste

No Dashboard do Stripe, na conta de **produção**:

1. **Produtos → Cupons → Criar cupom**: tipo "Porcentagem", `100%`, duração "Uma vez".
2. **Criar código promocional** vinculado ao cupom (ex.: `NASATESTE`).
3. Recomendado: **limite de 1 resgate** e **expiração curta**.

Depois do teste: cancele o pedido e **apague os dois `PaymentEntry`** criados na org da agência
(`documentNumber` = código do pedido, ex.: `TG-0042`).

## 9. Changelog

| Data | Mudança |
| --- | --- |
| 2026-09-17 | Spec criada. Fase A (`allow_promotion_codes: true`) implementada. Fase B desenhada, implementada e **revertida** por decisão do dono: a migration não se justificava para destravar o teste. Desenho preservado aqui; pendência registrada como P-9. |
