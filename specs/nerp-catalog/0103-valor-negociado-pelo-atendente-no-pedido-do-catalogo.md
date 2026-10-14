---
id: 0103
titulo: Valor do pedido do catálogo negociado pelo atendente e aprovado pelo cliente
dominio: nerp-catalog
status: em-revisao
autor: Claude (pedido da Órbita para a Armazém Carvalho)
criada: 2026-10-14
atualizada: 2026-10-14
branch: claude/stoic-bell-t9hvh9
pr:
peso: completa
---

# 0103 — Valor do pedido do catálogo negociado pelo atendente e aprovado pelo cliente

## 1. Contexto

A Armazém Carvalho quer vender pelo Catálogo online **sem preço na vitrine**. O valor é combinado
no WhatsApp: o Astro recebe a lista do pedido, percebe o interesse ("quero pagar", "quanto fica?"),
um atendente humano manda o valor negociado, o cliente aprova e só então sai o PIX ou o link de
pagamento do Asaas. Depois do pagamento o pedido segue para separação e entrega, e o cliente é
avisado em cada etapa.

Hoje o fluxo da spec 0044 não permite isso:

- O Astro é instruído a nunca mexer em valor e a transferir para humano (`order-context.ts`, regra 7),
  o que **desliga** a IA para o lead. Ninguém mais acompanha o cliente pela IA.
- Não existe tela para o atendente mudar o valor de um pedido. O total é o que veio do NERP.
- Produto sem preço gera pedido de R$ 0. A cobrança do Asaas falha (valor mínimo) com erro genérico.
- O cliente pode gerar PIX sozinho pelo portal (`pay-with-pix.ts`) a qualquer momento, inclusive de
  pedido que ainda está sendo negociado.
- Não há aviso ao cliente quando o pedido é entregue.

## 2. Objetivo

O atendente consegue mandar o valor negociado de um pedido do catálogo, o cliente aprova pelo
WhatsApp (ou portal), e nenhuma cobrança é gerada antes dessa aprovação; o Astro acompanha tudo,
do pedido à entrega, sem sair da conversa.

### Não-objetivos

- O Astro **não** decide preço nem desconto. Quem define o valor é sempre uma pessoa.
- Faixa de preço mínimo por produto, aprovação em níveis, alçada de desconto.
- Editar itens (incluir/remover produto, mudar quantidade). Só valores.
- Mudar o valor de pedido com cobrança já gerada (`AWAITING_PAYMENT`). Ver CB-4.
- Comissão, split ou repasse no Asaas. O repasse continua manual, fora da plataforma.
- Devolver ao NERP os preços unitários negociados. O NERP recebe o valor pago na confirmação (como hoje).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | `CatalogOrder` ganha `quoteRequestedAt`, `quotedAt`, `quotedById` e `quoteApprovedAt`, todos opcionais. |
| RF-2 | Ferramenta do Astro `request_catalog_order_quote`: marca `quoteRequestedAt`, põe o pedido em `NEGOTIATING`, aplica a tag "Quer orçamento" e avisa a equipe (sino/push, mesmo motor do "Cliente aguardando atendente"). **Não** pausa a IA. |
| RF-3 | Procedure `nerp.catalogOrders.sendQuote` (permissão `catalogo-online` `canEdit`): o atendente informa o preço unitário de cada item, o frete e o desconto. O servidor recalcula totais de item, subtotal e total, grava `quotedAt`/`quotedById`, zera `quoteApprovedAt`, atualiza `Lead.amount`, reativa a IA do lead (o próximo passo é do Astro) e envia ao cliente a mensagem com o valor e o pedido de aprovação. |
| RF-4 | Ferramenta do Astro `approve_catalog_order_quote`: só funciona com valor enviado; grava `quoteApprovedAt` e aplica a tag "Quer pagar". |
| RF-5 | Nenhuma cobrança (PIX ou link, pelo Astro ou pelo portal) é gerada quando: total ≤ 0; orçamento pedido e valor ainda não enviado; valor enviado e ainda não aprovado. A mensagem de erro diz o motivo em português. |
| RF-6 | O prompt do pedido passa a mostrar a situação do valor (sem valor / aguardando atendente / aguardando aprovação / aprovado) e a ensinar o fluxo novo. A regra "não altere preços" continua. |
| RF-7 | Ao pedir pagamento de pedido com valor, sem negociação, o Astro aplica a tag "Quer pagar" ao gerar a cobrança. |
| RF-8 | Novo aviso ao cliente quando o lead entra na coluna "Entregue" (`catalog.delivered`), uma vez por pedido, como os demais avisos de etapa. |
| RF-9 | Aba Produtos/Serviços do lead: pedido do catálogo em `RECEIVED`/`NEGOTIATING` mostra o botão "Enviar valor" e a situação do valor. |
| RF-10 | Portal `/pedido/<token>`: esconde "Gerar PIX" enquanto a cobrança estiver bloqueada, mostra "A combinar" no lugar de R$ 0 e explica a situação do valor. |
| RF-11 | Pedido de orçamento chega do NERP com preços de referência por item, calculados pela **tabela de preços do cliente** (`resolveManyPrices`): `referenceUnitPrice` (1 unidade) e `referenceBoxPrice` (faixa de `packQty` unidades × `packQty`), mais `packQty`. O formulário de valor já abre com o preço unitário de tabela e mostra "NERP: un. R$ X · caixa (N un.) R$ Y" em cada item; o consultor ajusta o que vai ofertar. Os preços de referência **não** entram no contexto do Astro nem chegam ao cliente antes do envio. |
| RF-12 | Painel "Propostas e Orçamentos" do chat ganha a aba **"Pedido"** quando o lead tem pedido do catálogo em `RECEIVED`/`NEGOTIATING`; abre nela por padrão. Usa o mesmo formulário e a mesma procedure do "Enviar valor" (`nerp.catalogOrders.sendQuote`). |
| RF-13 | Item com `packQty` > 1 tem seletor "por unidade / por caixa" no campo de preço. Por caixa, o valor digitado é dividido por `packQty`; o total do item é `quantidade × preço` arredondado a centavos **sem** arredondar o unitário antes, para a caixa fechar exata. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Cálculo de totais é função pura, arredondada a centavos, coberta por `scripts/catalog-quote-qa-check.ts`. |
| RNF-2 | Falha ao enviar a mensagem do valor ao cliente **não** desfaz o valor salvo: a procedure devolve `isDelivered: false` e a tela avisa o atendente. |
| RNF-3 | Pedidos existentes (campos novos nulos, total > 0) se comportam exatamente como antes. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado pedido com total R$ 0, quando o Astro ou o portal tenta gerar PIX/link, então a cobrança é recusada com "o atendente precisa enviar o valor" e nada é criado no Asaas.
- [ ] **CA-2** — Dado pedido com orçamento pedido e sem valor enviado, quando qualquer caminho tenta cobrar, então é recusado com "aguardando o valor do atendente".
- [ ] **CA-3** — Dado valor enviado e não aprovado, quando qualquer caminho tenta cobrar, então é recusado com "aguardando aprovação do cliente".
- [ ] **CA-4** — Dado valor enviado e aprovado, quando o Astro gera PIX, então a cobrança sai com o total negociado.
- [ ] **CA-5** — Dado pedido antigo (campos novos nulos) com total > 0, quando o Astro gera PIX, então funciona como hoje.
- [ ] **CA-6** — Dado preços 10,00 × 3 e 2,50 × 2, frete 5,00 e desconto 1,00, quando o atendente envia, então itens 30,00 e 5,00, subtotal 35,00, total 39,00.
- [ ] **CA-7** — Dado desconto que zera ou deixa o total negativo, quando o atendente envia, então é recusado e nada é gravado.
- [ ] **CA-8** — Dado pedido em `AWAITING_PAYMENT` ou depois, quando o atendente tenta enviar valor, então é recusado.
- [ ] **CA-9** — Dado valor aprovado, quando o atendente reenvia outro valor, então a aprovação é zerada e o cliente precisa aprovar de novo.
- [ ] **CA-10** — Dado lead entrando em "Entregue" com pedido pago, então o cliente recebe uma vez o aviso de entrega.
- [ ] **CA-11** — Dado `request_catalog_order_quote`, então o lead continua com a IA ativa, recebe a tag "Quer orçamento" e a equipe recebe o alerta.
- [ ] **CA-12** — Dado um pedido de orçamento cujo produto custa R$ 12,50 na tabela do cliente e R$ 11,00 a partir de 12 unidades (caixa com 12), quando o consultor abre o formulário de valor, então o item vem preenchido com 12,50 e mostra "caixa (12 un.) R$ 132,00", e o valor pode ser alterado.
- [ ] **CA-14** — Dado um item com caixa de 12 e 24 unidades no pedido, quando o consultor escolhe "por caixa" e digita 100,00, então o item fecha em R$ 200,00 (unitário exibido R$ 8,33); o total do item parte do preço sem arredondar.
- [ ] **CA-13** — Dado um lead com pedido do catálogo aguardando valor, quando o consultor abre "Propostas e Orçamentos" no chat, então a aba "Pedido" aparece selecionada; sem pedido pendente, a aba não aparece.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Pedido antigo, sem nenhum campo novo, total > 0 | Fluxo atual intacto: cobra direto (RNF-3). |
| CB-2 | Pedido antigo com total 0 (já existe em produção?) | Cobrança recusada com motivo claro, em vez do erro genérico do Asaas. Atendente envia o valor pela tela. |
| CB-3 | Cliente gera PIX pelo portal durante a negociação | Recusado pelo mesmo bloqueio do RF-5 (o portal usa `createOrderPixCharge`). |
| CB-4 | Atendente quer mudar valor com cobrança já gerada | Recusado (`AWAITING_PAYMENT`). A cobrança antiga poderia ser paga pelo valor velho; cancelar no Asaas e reabrir fica fora desta spec. |
| CB-5 | Dois atendentes enviam valor ao mesmo tempo | `updateMany` com status no `where`: o último vence; cada envio zera a aprovação, então o cliente aprova o valor que recebeu por último. |
| CB-6 | Atendente envia valor fora da janela de 24h da API oficial | Valor salvo; envio falha; `isDelivered: false` e aviso na tela (RNF-2). O portal mostra o valor novo. |
| CB-7 | Astro chama `approve_catalog_order_quote` sem valor enviado | Ferramenta devolve erro "ainda não há valor enviado"; nada muda. |
| CB-8 | Quantidade fracionada (kg) | Total do item = quantidade × preço, arredondado a centavos. |
| CB-9 | Lista de preços com número de itens diferente do pedido | Recusado (`BAD_REQUEST`). |
| CB-10 | Tags "Quer orçamento"/"Quer pagar" não existem na empresa | Criadas na hora (org, sem tracking), como as tags de etapa. Arquivadas são restauradas. |
| CB-11 | Pedido cancelado ou entregue | Ferramentas de pedido não aparecem (já é assim: só pedido aberto). |

## 6. Decisões de design

### D-1 — Campos de data em vez de novos status

- **Escolha**: `quoteRequestedAt`, `quotedAt`, `quoteApprovedAt` no `CatalogOrder`; status segue `NEGOTIATING`.
- **Alternativas descartadas**: novos valores no enum `CatalogOrderStatus` — exigiria revisar todos os `switch`/mapas de status (portal, aba do lead, insights) e o mapeamento de colunas da spec 0044.
- **Consequência**: a "situação do valor" é derivada (função pura `resolveQuoteState`).

### D-2 — Pedido de orçamento não pausa a IA

- **Escolha**: ferramenta própria, que só avisa a equipe e aplica tag.
- **Alternativa descartada**: `transfer_to_human` — desliga a IA do lead, e o pedido é que o atendimento digital acompanhe tudo.

### D-3 — Bloqueio de cobrança no ponto único `chargeOrder`

- **Escolha**: a regra mora em `chargeOrder`, que serve Astro e portal.
- **Consequência**: qualquer caminho novo de cobrança herda o bloqueio.

## 7. Impacto

- [x] Schema / migration — 4 colunas opcionais em `catalog_orders` (só `ADD COLUMN`, reversível).
- [x] Procedures oRPC — `nerp.catalogOrders.sendQuote`; `leads.listProducts` devolve frete, desconto e situação do valor.
- [ ] Realtime — usa os já existentes (mensagem nova no chat, `lead:updated`).
- [ ] Automações (Inngest) — nenhuma nova. As tags disparam fluxos "Lead com Tag" já existentes.
- [ ] Env vars novas
- [ ] Breaking change
- [x] Documentação — `docs/nerp-catalog-orbita.md`.

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-2, CA-3, CA-5 | automatizado | `scripts/catalog-quote-qa-check.ts` (`getChargeBlockReason`) |
| CA-6, CA-7, CA-14, CB-8 | automatizado | `scripts/catalog-quote-qa-check.ts` (`computeQuotedTotals`) |
| CA-4, CA-8, CA-9, CA-10, CA-11, CA-12, CA-13 | manual | Pedido de teste da Armazém Carvalho em sandbox do Asaas |

## 9. Riscos e rollback

- **Pedido de R$ 0 que antes "passava" até o Asaas** agora é barrado mais cedo, com mensagem clara. Mesmo resultado final (sem cobrança).
- **Rollback**: reverter o código; as colunas podem ficar (nulas não afetam nada) ou sair com `ALTER TABLE catalog_orders DROP COLUMN ...`.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-14 | Claude | Criada |
| 2026-10-14 | Claude | RF-11/CA-12: preços da tabela do NERP (unidade e caixa) como base do valor; RF-12/CA-13: aba "Pedido" no Propostas e Orçamentos do chat. Exige o NERP enviar `referenceBoxPrice`/`packQty` (nerp-2, `deliver-order.ts`) |
| 2026-10-14 | Claude | RF-13/CA-14: seletor por unidade / por caixa; total do item parte do preço sem arredondar |
