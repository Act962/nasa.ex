---
id: 0123
titulo: trafeGO cobra só o serviço (30%, mínimo R$ 150), complemento pelo gasto real e wizard da org logada
dominio: trafego
status: implementada
autor: Weydson Lima
criada: 2026-10-30
atualizada: 2026-10-30
branch: feature/W-trafego-base-meta-desempenho-20261030
pr: # preenchido no /ship
peso: completa
---

# 0123 — Cobrança só do serviço, complemento pelo gasto real e wizard da org logada

> Entrega B do plano em três (A = spec 0122, C = spec 0124). Depende da 0122: o gasto
> real é lido pela integração Meta dos Satélites da org do pedido (`resolveOrderMetaAccess`).

## 1. Contexto

Decisões do dono em 30/10/2026:

1. **A verba de tráfego não passa mais pela Órbita.** O cliente paga a Meta direto, no cartão dele, dentro da própria conta de anúncios. A Órbita cobra só o serviço, para **todos** os pedidos novos.
2. **A taxa passa a ser 30% fixa sobre a verba declarada, com mínimo de R$ 150 por pedido.** Hoje são faixas de 50/40/35/30/25%. O setup continua por faixa e só para quem não tem conta de anúncios.
3. **A taxa acompanha o gasto real.** Se o cliente declara R$ 300 e coloca R$ 2.000 no Meta, a taxa passa a ser calculada sobre o que foi gasto de verdade. O excedente gera uma **cobrança de complemento automática**. A base é o **gasto da conta toda no período do pedido**, porque contar só as campanhas com o código no nome deixaria o cliente escapar criando outra campanha. A equipe pode tirar da conta campanhas que não são do trafeGO.
4. **Complemento não pago trava o painel** (não cria nem publica campanha) e avisa a equipe. As campanhas do cliente no Meta não são tocadas.
5. **No `/trafego?nova=1`, quem já é membro de uma org contrata dentro dela.** Hoje, sem pedido anterior, a compra cai numa org nova (ver o caso TG-0002). Se a org já tem a Meta conectada nos Satélites, o wizard não pergunta de novo o que já sabemos.

Fatos do código que este desenho precisa respeitar:
- **Não há coluna que diga o modelo de cobrança do pedido.** Os criativos extras são derivados: `total − verba − taxa − setup` (`sale-side-effects.ts`, `order-values.ts`). Com a verba fora do total, essa conta zeraria os extras sem avisar.
- **As Cobranças da spec 0115 já existem.** `PaymentEntry` a receber, link `/cobranca/<token>`, PIX copia-e-cola e régua por evento. Não há um caminho único de confirmação de pagamento: a baixa é manual ou por conciliação.

## 2. Objetivo

Pedido novo cobra só o serviço; o gasto real acima da verba declarada gera complemento de 30%, e quem já é membro de uma org contrata dentro dela, sem repetir dados que a plataforma já tem.

### Não-objetivos

- Mudar pedidos antigos: quem pagou verba + taxa segue no modelo antigo, inclusive no financeiro.
- Complemento para Google Ads e WhatsApp Oficial. A leitura de gasto real existe só para o Meta.
- Mandar o complemento sozinho ao cliente nesta versão: ele nasce como **rascunho** e a equipe envia (D-4).
- Pausar ou alterar campanhas do cliente no Meta por falta de pagamento.
- Cobrança recorrente mensal e assinatura.
- Criar ou publicar campanha pelo painel (spec 0124). Aqui só a trava fica pronta para ela usar.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Preço: `taxa = max(round(30% × verba), R$ 150)`. O setup segue a faixa da verba (R$ 500 / 450 / 400 / 0 / 0) e só vale para quem não tem conta, ou não tem número na API Oficial. Os criativos extras não mudam. A verba continua limitada entre R$ 300 e R$ 500.000. |
| RF-2 | Checkout: o Stripe recebe só as parcelas de serviço, setup e extras; a parcela "Verba de tráfego" sai. A cobrança PIX do Asaas usa o mesmo total. O total guardado na pendência é esse valor. |
| RF-3 | Coluna `adBudgetPaidToMeta Boolean @default(false)` em `TrafegoPendingPurchase` e em `TrafegoOrder`. O checkout novo grava `true`, e o pedido criado da pendência herda o valor. Pendências e pedidos de antes desta spec ficam `false`. |
| RF-4 | Pedido avulso (spec 0116): nasce com `adBudgetPaidToMeta=true`. O diálogo tem um switch "A verba foi paga à Órbita (modelo antigo)" para os casos de exceção. O total é taxa + setup, mais a verba só no modelo antigo. |
| RF-5 | `deriveExtraCreativesBrlCents` passa a considerar o modelo: no novo, extras = total − taxa − setup; no antigo, a conta de hoje. Vale também para o "Corrigir valores" (spec 0122). |
| RF-6 | Financeiro: no modelo novo não há lançamento a pagar de repasse de verba; a receita continua sendo taxa + setup + extras. O estorno total (P-5) segue igual. |
| RF-7 | Textos. Landing, simulador e resumo do pedido dizem "verba de tráfego — você paga direto à Meta; usamos esse valor para calcular o serviço" e "a pagar agora = serviço + setup + extras". A tabela de faixas e o aviso "invista mais e a taxa cai" saem. O mesmo ajuste vale para o e-mail e o WhatsApp de confirmação, o painel ("Verba (paga à Meta)" e "Total pago" = o que a Órbita cobrou), o prompt e a ferramenta `simular_investimento` do assistente público e os termos (RF-8). |
| RF-8 | Termos com versão nova (`TRAFEGO_TERMS_VERSION`). Cláusulas: a verba é paga pelo cliente diretamente à Meta; a taxa de serviço é de 30% sobre a verba, com mínimo de R$ 150; gasto real acima da verba declarada gera complemento de 30% sobre o excedente; complemento vencido suspende as funções de criação e publicação do painel. |
| RF-9 | Wizard: com `?nova=1`, membro logado com org ativa **sem** pedido anterior entra no fluxo autenticado, e o pedido é criado na org ativa. O cartão "Usar dados de…" mostra o nome da org. |
| RF-10 | Wizard com a Meta da org ativa conectada e testada (`connectionCheck.canRead`, spec 0122). "Você já tem conta de anúncios?" vem como **Sim** (sem setup). O @ do Instagram vem da página da conta. "Seu Instagram e Facebook já estão vinculados?" vem como **Sim**, com o texto "conta Meta conectada nos Satélites". O **passo 5 (Contato) é pulado** quando nome, e-mail e telefone da sessão (ou do pedido anterior) são válidos; se faltar o telefone, o passo aparece só com ele. A captura de lead (spec 0021) passa a disparar ao sair do passo de prazo quando o Contato é pulado. |
| RF-11 | Complemento, cálculo. Vale para pedido META_ADS com `adBudgetPaidToMeta`, `startedAt` definido e integração Meta da org do pedido em modo conta. Uma vez por dia, ao fim do cron que já existe (`sync-meta-ads-kpis`), num único passo: `gasto` = gasto da conta toda de `startedAt` até hoje (no máximo `endsAt` + 3 dias), menos as campanhas marcadas como fora do trafeGO. `devido = max(30% × gasto, R$ 150)`, e `já cobrado` = taxa do pedido + complementos não cancelados. Se `devido − já cobrado ≥ R$ 30`, nasce um complemento. |
| RF-12 | Complemento, registro. Um `PaymentEntry` a receber, criado com `createPaymentEntryRecord` (spec 0115) na org da agência:<br>• número `TG-NNNN-C1`, `-C2`…<br>• lead = card do pedido<br>• vencimento = hoje + 3 dias<br>• categoria de receita do trafeGO<br>• **sem régua**, porque é rascunho (D-4).<br><br>Junto: um evento interno no pedido e o aviso aos admins "complemento para enviar". |
| RF-13 | Admin do pedido, cartão **"Complementos"**:<br>• lista os complementos com valor, status e link;<br>• **"Enviar cobrança"** atribui a régua padrão das Cobranças, que manda o link e o PIX;<br>• **"Cancelar"** cancela o lançamento;<br>• o campo **"Campanhas fora do trafeGO"** escolhe campanhas da conta, gravadas em `TrafegoOrder.metaCampaignIdsOutsideService`. |
| RF-14 | Painel do cliente, no Desempenho: "Taxa sobre o gasto real" com taxa devida, já paga e complemento em aberto (com o link de pagamento quando enviado). |
| RF-15 | Trava. Complemento **enviado** (com régua) e vencido (vencimento antes de hoje, em Brasília, e status em aberto) faz quatro coisas:<br>• bloqueia a criação e a publicação de campanha pelo painel (o guarda da spec 0124 consulta `hasOverdueTrafegoComplement`);<br>• bloqueia o botão "Nova campanha" do painel;<br>• mostra um aviso com o link de pagamento;<br>• avisa a equipe uma vez por complemento. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhum cron ou função Inngest novo (S11). O complemento entra como **um passo** no fim de `sync-meta-ads-kpis`, uma vez por dia. São 1 leitura da Meta por pedido ativo, e ~30 execuções de passo por mês. |
| RNF-2 | Idempotência: o "já cobrado" vem da soma dos lançamentos `TG-NNNN-C*` não cancelados. Rodar duas vezes no mesmo dia não duplica. |
| RNF-3 | Nada de chamada à Meta dentro de `$transaction` (regra 18). |
| RNF-4 | Conta em moeda diferente de BRL: não calcula complemento e registra um evento interno. |
| RNF-5 | Migration aditiva, só com 3 colunas: `TrafegoPendingPurchase.adBudgetPaidToMeta`, `TrafegoOrder.adBudgetPaidToMeta` e `TrafegoOrder.metaCampaignIdsOutsideService String[] @default([])`. Sem tabela. |

## 4. Critérios de aceite

- [ ] **CA-1** — Verba R$ 300 → taxa R$ 150 (mínimo); R$ 1.000 → R$ 300; R$ 5.000 → R$ 1.500; verba R$ 300 sem conta → setup R$ 500.
- [ ] **CA-2** — O checkout do Stripe de um pedido novo não tem a parcela "Verba de tráfego", e o total cobrado = taxa + setup + extras. O PIX cobra o mesmo valor.
- [ ] **CA-3** — Pedido criado de pendência nova tem `adBudgetPaidToMeta=true`; pendência anterior à spec paga depois do deploy gera pedido com `false` e segue o modelo antigo no financeiro.
- [ ] **CA-4** — Pedido novo com 2 criativos extras de R$ 40: os extras derivados dão R$ 80 (não zeram) e entram na receita.
- [ ] **CA-5** — Pedido novo não cria lançamento a pagar de repasse; pedido antigo continua criando.
- [ ] **CA-6** — Membro logado de uma org sem pedido abre `/trafego?nova=1`, paga, e o pedido nasce **na org ativa** (não numa org nova).
- [ ] **CA-7** — Org com a Meta testada: o wizard não mostra o passo Contato; a pergunta de BM e a de "vinculados" vêm como Sim; o lead é capturado mesmo sem o passo Contato.
- [ ] **CA-8** — Pedido com verba de R$ 300 e gasto real de R$ 2.000 na conta: devido R$ 600, cobrado R$ 150, nasce `TG-NNNN-C1` de R$ 450 sem régua; rodar de novo no mesmo dia não cria `C2`.
- [ ] **CA-9** — Com R$ 1.500 de gasto em campanhas marcadas como fora do trafeGO, o gasto considerado cai R$ 1.500.
- [ ] **CA-10** — Gasto real abaixo da verba declarada ou diferença abaixo de R$ 30: nenhum complemento.
- [ ] **CA-11** — "Enviar cobrança" atribui a régua padrão e o cliente recebe o link; "Cancelar" deixa o lançamento cancelado e ele sai da soma do "já cobrado".
- [ ] **CA-12** — Complemento enviado e vencido: `hasOverdueTrafegoComplement` = true, o painel mostra o aviso e esconde "Nova campanha"; rascunho vencido não trava.
- [ ] **CA-13** — Pedido antigo (`adBudgetPaidToMeta=false`) nunca gera complemento.
- [ ] **CA-14** — Os termos mostram a versão nova e o checkout grava essa versão.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Pendência criada antes do deploy e paga depois | `adBudgetPaidToMeta=false`: o cliente pagou verba + taxa, então segue o modelo antigo (CA-3). |
| CB-2 | Integração Meta da org cai (token vencido) | O complemento não é calculado naquele dia; evento interno uma vez por dia, no máximo. |
| CB-3 | Pedido sem `startedAt` (não foi ao ar) | Sem complemento. |
| CB-4 | Gasto de campanha de outra agência na mesma conta | A equipe marca a campanha como fora do trafeGO (RF-13). |
| CB-5 | Complemento pago em parte | Conta como "já cobrado" pelo valor total; segue em aberto para a trava até ser pago. |
| CB-6 | Pedido terminado há mais de 3 dias | Para de calcular complemento. |
| CB-7 | Usuário sem telefone na conta | O passo Contato aparece só com o telefone (RF-10). |
| CB-8 | Org com Meta conectada mas sem teste ou com teste falho | O wizard não pré-marca nada: segue o fluxo atual. |
| CB-9 | Cupom no checkout novo | O desconto continua sendo distribuído taxa → setup → extras; sem verba na cobrança, ele nunca chega na verba. |

## 6. Decisões de design

### D-1 — Coluna de modelo em vez de derivar pela data ou pelos termos
- **Escolha**: `adBudgetPaidToMeta` na pendência e no pedido.
- **Alternativas descartadas**: derivar pela data de criação (pendência anterior paga depois quebraria) ou por `acceptedTermsVersion` (é null no pedido avulso).
- **Consequência**: toda conta que envolve total, extras ou repasse lê a coluna.

### D-2 — Base do complemento = conta toda no período, com exclusão manual
- **Escolha**: base é a conta toda, e a equipe exclui o que não é trafeGO.
- **Alternativa descartada**: somar só as campanhas com o código, o que permitiria o desvio.
- **Consequência**: gasto de outra agência na mesma conta precisa ser marcado pela equipe.

### D-3 — Reaproveitar o cron diário e as Cobranças da 0115
- **Escolha**: um passo no `sync-meta-ads-kpis` e `createPaymentEntryRecord` com régua.
- **Alternativas descartadas**: cron novo (S11) ou integração de cobrança própria (já existe).

### D-4 — Complemento nasce como rascunho na v1
- **Escolha**: lançamento sem régua, e a equipe envia com um clique.
- **Por quê**: é a primeira cobrança criada sozinha pelo sistema. Conferir as primeiras evita cobrar errado.
- **Saída**: quando a equipe confiar, passar a régua padrão na criação (uma linha) e registrar no changelog.

### D-5 — Trava só para complemento enviado e vencido
- **Por quê**: rascunho não foi visto pelo cliente; travar por ele seria punir por uma pendência da própria equipe.

## 7. Impacto

- [x] Schema / migration: 3 colunas (RNF-5), migration aditiva e reversível.
- [x] Procedures oRPC:
  - novas: `trafego.admin.orders.complements.{list,send,cancel}`, `trafego.admin.orders.setOutsideCampaigns`, `trafego.performance.serviceFee`
  - alteradas: checkout, pedido avulso, "Corrigir valores" e painel.
- [x] Automações (Inngest): um passo a mais no cron existente.
- [ ] Env vars novas: não.
- [x] Breaking change: preço e termos novos para pedidos novos.
- [x] Documentação: `docs/trafego-overview.md` e `docs/trafego-playbook-gestor.md`.

### Segurança de dados

- O complemento só é calculado com o token da org do pedido (spec 0122). O gasto lido não sai da agência, a não ser o valor agregado mostrado ao próprio cliente.
- As ações de complemento e as campanhas fora do trafeGO são só de admin do sistema.
- O cliente vê apenas os próprios complementos (pedido escopado pela org da sessão).

### Regras da Meta

- Só leitura de insights (`spend` no nível da conta e das campanhas excluídas), com atribuição unificada e cache.
- A Órbita não movimenta a verba: a cobrança do anúncio é entre o cliente e a Meta, no meio de pagamento da conta dele.

## 8. Plano de testes

O script `scripts/trafego-0123-qa-check.ts` testa as funções puras: preço, extras por modelo, cálculo do complemento e trava. O resto é manual.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-4, CA-8, CA-9, CA-10, CA-12, CA-13 | automatizado (script) | Funções puras de preço, complemento e trava. |
| CA-2, CA-3, CA-5, CA-14 | manual | Checkout em modo teste do Stripe; leitura do pedido e do financeiro no banco de desenvolvimento. |
| CA-6, CA-7 | manual | Usuário de teste numa org sem pedido, com e sem Meta testada. |
| CA-11 | manual | Admin envia e cancela um complemento no banco de desenvolvimento. |

## 9. Riscos e rollback

- **Preço novo**: sessões do Stripe abertas antes do deploy cobram o valor antigo e geram pedido no modelo antigo (CB-1). O rollback é reverter a PR; as colunas ficam sem uso.
- **Complemento errado**: mitigado pelo rascunho (D-4) e pela exclusão de campanhas.
- **Migration** aditiva (3 colunas com default): reversível.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-30 | Weydson Lima (com Claude) | Criada (entrega B). |
| 2026-10-30 | Weydson Lima (com Claude) | Implementada. Divergências: (a) sem telefone válido o passo Contato aparece inteiro, com nome e e-mail preenchidos, e não só o telefone (RF-10, CB-7); (b) nova procedure `trafego.performance.billingLock` (só banco) para a lista de campanhas saber da trava sem ler a Meta; (c) "Enviar cobrança" empurra o vencimento para hoje + 3 dias quando o rascunho esperou, para não chegar ao cliente já vencido; (d) cancelar complemento pede motivo e recusa se já houve pagamento; (e) o número do complemento pula os cancelados (`C2` depois de `C1` cancelado); (f) complemento só nasce quando o gasto passou da verba declarada, para uma taxa negociada abaixo de 30% não virar cobrança sozinha (CA-10). |
