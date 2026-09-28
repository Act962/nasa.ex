---
id: 0023
titulo: Coerência de pagamento parcial e saldo de conta
dominio: payment
status: aprovada
autor: Weydson
criada: 2026-09-22
atualizada: 2026-09-22
branch: feature/W-financeiro-melhorias-20260922
pr:
peso: completa
---

# 0023 — Coerência de pagamento parcial e saldo de conta

---

## 1. Contexto

Auditoria feita em produção (org CONSULTORIA NASA, competência Setembro/2026)
mostrou quatro números que não fecham entre si na mesma tela:

| Onde | Valor exibido |
| --- | --- |
| Fluxo de Caixa — Total Entradas | R$ 20.510,65 |
| Fluxo de Caixa — Total Saídas | R$ 14.927,53 |
| Despesa — Total pendente | R$ 6.841,91 |
| Despesa — Total pago | R$ 10.225,62 |
| Contas — Saldo total | R$ 200,64 |
| Saldo real na conta bancária | R$ 1.478,58 |

A investigação encontrou **dois lançamentos em estado impossível**:

| Lançamento | `amount` | `paidAmount` | `status` |
| --- | --- | --- | --- |
| João Gabriel — Parcela 2/12 | R$ 1.100,00 | R$ 1.100,00 | `PARTIAL` |
| Suellen — Parcela 2/12 | R$ 500,00 | **R$ 1.500,00** | `PARTIAL` |

`payPaymentEntryRecord` valida corretamente (recusa valor acima do saldo devedor
e promove para `PAID` quando `paidAmount >= amount`). Mas
`updatePaymentEntryRecord` grava `amount`, `paidAmount` e `status` **crus**, sem
revalidar a coerência entre eles — editar o valor de um lançamento já pago deixa
o registro incoerente e ninguém percebe.

A partir daí os agregados se contaminam em cascata:

1. `pendingAmount` soma `amount` **cheio** de `PARTIAL` (R$ 1.600,00 entram
   inteiros, embora R$ 2.600,00 já tenham sido pagos) — daí R$ 6.841,91 em vez
   de R$ 5.241,91.
2. `paidAmount` do card soma `paidAmount` de **todos** os lançamentos do filtro,
   inclusive `PARTIAL` e `CANCELLED`, enquanto `pendingAmount` soma `amount`.
   Dois cards lado a lado com bases diferentes. Dos R$ 10.225,62, R$ 7.625,62
   são de lançamentos `PAID` e R$ 2.600,00 vêm dos dois parciais quebrados.
3. `loadCashflow` lança o `PARTIAL` pelo `amount` cheio na data de **vencimento**
   e descarta o `paidAmount`: os R$ 2.600,00 pagos em 10/09 não aparecem em
   10/09, e R$ 1.600,00 aparecem como saída futura em 20/09 que na prática já
   saiu.
4. `PaymentBankAccount.balance` é digitado à mão e nenhuma baixa o movimenta —
   o "Saldo total" de R$ 200,64 é o saldo **inicial** cadastrado, sem relação com
   os R$ 1.478,58 reais.

## 2. Objetivo

Um lançamento nunca fica em estado incoerente, e todo número de caixa da tela
respeita a separação entre **o que já liquidou** e **o que ainda falta**.

### Não-objetivos

- Conciliação bancária automática (já coberta pela spec 0013 — OFX).
- Sobrescrever `balance` a partir dos lançamentos. `balance` é o saldo
  **inicial** e alimenta o saldo de abertura da projeção (spec 0009); mexer nele
  mudaria a projeção sem o usuário saber.
- Corrigir os dois registros de Setembro/2026 por migration. A correção do dado
  é manual e do usuário — a regra nova só impede que aconteça de novo.
- Mexer nos agregados de `load-dashboard`, na Projeção ou no DRE nesta spec. O card
  "Valor atual no caixa" do Painel é exceção: ele lê `payment.accounts.list`
  direto e passaria a divergir da aba Contas se ficasse de fora (RF-8).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | `updatePaymentEntryRecord` recalcula o estado final (`amount`, `paidAmount`, `status`) e recusa a gravação quando `paidAmount > amount`. |
| RF-2 | Quando o patch não informa `status` explicitamente, o status é derivado do par (`amount`, `paidAmount`) final: `0` → `PENDING`; `0 < paidAmount < amount` → `PARTIAL`; `paidAmount >= amount` → `PAID`. `PENDING_APPROVAL` e `CANCELLED` são preservados. |
| RF-3 | `totals.pendingAmount` passa a somar o **saldo devedor** (`amount - paidAmount`) dos status em aberto, não o valor cheio. |
| RF-4 | `totals.paidAmount` passa a excluir lançamentos `CANCELLED`, para que os dois cards do cabeçalho tenham a mesma base. |
| RF-5 | `loadCashflow` lança o `PARTIAL` em **duas** datas: o `paidAmount` na data de pagamento (`paidAt`) e o saldo devedor na data de vencimento (`dueDate`). Cada perna só entra se sua data cair no período. |
| RF-6 | `payment.accounts.list` devolve, por conta, a movimentação liquidada (`settledIn`, `settledOut`) e o saldo calculado (`computedBalance = balance + settledIn - settledOut`). |
| RF-7 | A aba Contas exibe o saldo calculado como número principal e o saldo inicial como linha secundária, por conta e no total. |
| RF-8 | O card "Valor atual no caixa" do Painel e a tool `list_payment_accounts` do Astro citam o mesmo saldo calculado da aba Contas. |
| RF-9 | A aba Contas tem "Ajustar saldo": o usuário digita o **saldo atual do extrato** e o sistema deduz o saldo inicial (`balance = atual − baixas`). Pedir o inicial obrigaria a fazer a conta de cabeça toda vez. |
| RF-10 | "Editar lançamento" → "Mais opções" tem "Parcela X de Y", que corrige o rótulo **deste** lançamento, e um checkbox "Lançamento avulso" que limpa os três campos de parcela. Não cria nem apaga lançamento. |
| RF-11 | O mesmo bloco tem "Gerar parcelas seguintes", que cria as posições faltantes de `installmentCurrent + 1` até `installmentTotal`, mês a mês a partir do vencimento atual, no mesmo valor, com status `PENDING`. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | O cálculo do saldo por conta é feito em **uma** agregação (`groupBy accountId`), não uma query por conta. |
| RNF-2 | Nenhuma migration. Todos os campos já existem no schema. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um lançamento de R$ 500,00 com `paidAmount` R$ 0,00, quando o `update` tenta gravar `paidAmount` R$ 1.500,00, então a procedure responde erro de validação e nada é gravado.
- [ ] **CA-2** — Dado um lançamento `PARTIAL` de R$ 1.100,00 com `paidAmount` R$ 800,00, quando o `update` grava `paidAmount` R$ 1.100,00 sem informar `status`, então o registro fica `PAID`.
- [ ] **CA-3** — Dado um lançamento `PAID` de R$ 1.500,00 com `paidAmount` R$ 1.500,00, quando o `update` baixa o `amount` para R$ 500,00, então a gravação é recusada (o pago excede o novo valor).
- [ ] **CA-4** — Dado o mês com um `PARTIAL` de R$ 1.100,00 e R$ 400,00 pagos, quando a aba Despesa carrega, então "Total pendente" conta R$ 700,00 desse lançamento, não R$ 1.100,00.
- [ ] **CA-5** — Dado um lançamento `CANCELLED` com `paidAmount` > 0 no período, quando a aba carrega, então esse valor **não** entra em "Total pago".
- [ ] **CA-6** — Dado um `PARTIAL` com `paidAt` 10/09 (R$ 400,00) e `dueDate` 20/09 (R$ 1.100,00 de valor), quando o Fluxo de Caixa carrega Setembro, então 10/09 tem R$ 400,00 de saída e 20/09 tem R$ 700,00.
- [ ] **CA-7** — Dada uma conta com saldo inicial R$ 200,00, R$ 1.000,00 recebidos e R$ 300,00 pagos liquidados, quando a aba Contas carrega, então o saldo calculado exibido é R$ 900,00 e o saldo inicial R$ 200,00.
- [ ] **CA-8** — Dado o mesmo estado de CA-7, quando o Painel e o Astro são consultados, então ambos citam R$ 900,00.
- [ ] **CA-9** — Dada a conta de CA-7 (calculado R$ 900,00), quando o usuário informa saldo atual R$ 1.000,00 em "Ajustar saldo", então `balance` passa a R$ 300,00 e o saldo calculado passa a R$ 1.000,00.
- [ ] **CA-10** — Dado um lançamento rotulado "Parcela 2/4" que deveria ser "3/12", quando o usuário corrige os dois campos e salva, então só esse lançamento muda e nenhum outro é criado.
- [ ] **CA-11** — Dado um lançamento avulso de R$ 500,00 vencendo 20/09, quando o usuário marca 3 parcelas e usa "Gerar parcelas seguintes", então nascem duas parcelas de R$ 500,00 (20/10 e 20/11), a série ganha um `installmentGroupId` e a original vira 1/3.
- [ ] **CA-12** — Dada uma série 2/12 com as parcelas 3 e 4 já existentes, quando o usuário gera para 12, então só as posições 5 a 12 são criadas.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Registro legado já incoerente (`paidAmount > amount`), editado sem tocar em valores | A gravação é recusada com a mensagem do saldo. O usuário precisa corrigir `amount` ou `paidAmount` no mesmo patch. É o comportamento desejado: o dado ruim para de circular. |
| CB-2 | `status: "CANCELLED"` explícito no patch | Respeitado. O cancelamento não é derivado do valor. |
| CB-3 | `status: "PENDING_APPROVAL"` explícito no patch | Respeitado. Aprovação é fluxo de governança, não de caixa. |
| CB-4 | Patch informa `status: "PAID"` mas `paidAmount` (final) é 0 | O status explícito vence e `paidAmount` é promovido para `amount` — é como a tela marca "pago" sem digitar valor. |
| CB-5 | `PARTIAL` com `paidAt` nulo | A perna do pago cai na data de vencimento, como já fazia o `PAID` sem `paidAt`. |
| CB-6 | `PARTIAL` com `paidAt` fora do período e `dueDate` dentro | Só a perna do saldo devedor entra no fluxo do período. |
| CB-7 | `PARTIAL` com `paidAt` dentro do período e `dueDate` fora | Só a perna do pago entra. Isto **muda** o total do fluxo: passa a capturar caixa que antes sumia. |
| CB-8 | `PARTIAL` com saldo devedor zero (legado) | A perna do vencimento soma 0 e não cria linha de dia sozinha. |
| CB-9 | Lançamento liquidado sem `accountId` | Entra no total geral da aba Contas como "sem conta", nunca rateado entre contas. |
| CB-10 | Conta inativa | Fica fora da listagem e do total, como hoje. |
| CB-11 | `OVERDUE` parcialmente pago | Trata igual a `PARTIAL` em RF-3 e RF-5 — é status em aberto com `paidAmount`. |
| CB-12 | "Ajustar saldo" com valor que deixa o inicial negativo | Permitido. Conta que começou no vermelho é um fato, não um erro de digitação. |
| CB-13 | Gerar parcelas em lançamento `CANCELLED` | Recusado com mensagem. Cancelado não gera série. |
| CB-14 | Gerar parcelas com total ≤ parcela atual | Recusado: não há posição a criar, e aceitar silenciosamente esconderia o erro de digitação. |
| CB-15 | Gerar parcelas numa série onde todas as posições já existem | Recusado com "Todas as parcelas dessa série já existem" — nunca duplica. |
| CB-16 | Série com total novo maior que o antigo (ex.: 4 → 12) | As parcelas já existentes do grupo têm o `installmentTotal` atualizado junto, senão a lista mostraria "2/4" ao lado de "3/12" na mesma série. |
| CB-17 | Vencimento em dia 31 e mês seguinte com 30 dias | `addCalendarMonths` resolve, a mesma função que a criação com parcelas já usa. |

## 6. Decisões de design

### D-1 — Validar no serviço, não no Zod da procedure

- **Escolha**: a coerência é checada dentro de `updatePaymentEntryRecord`, que já
  lê o registro existente.
- **Alternativas descartadas**: `.superRefine` no input da procedure — não tem
  acesso ao `amount`/`paidAmount` atuais quando o patch é parcial, que é o caso
  comum. Trigger no banco — invisível para quem lê o código e sem mensagem em
  português.
- **Consequência**: o Astro e a tela pegam a mesma regra, porque ambos chamam o
  serviço.

### D-2 — Status derivado só quando não é informado

- **Escolha**: se o patch traz `status`, ele vence (exceto se violar RF-1).
- **Alternativas descartadas**: derivar sempre — quebraria `CANCELLED` e
  `PENDING_APPROVAL`, que não têm relação com valor pago.
- **Consequência**: a UI continua podendo marcar um lançamento como pago sem
  digitar valor (CB-4).

### D-3 — Parcial com duas pernas no fluxo, em vez de uma escolha

- **Escolha**: `paidAmount` em `paidAt`, saldo devedor em `dueDate`.
- **Alternativas descartadas**: (a) tudo no vencimento pelo valor cheio — é o bug
  atual, mostra como futuro dinheiro que já saiu; (b) tudo no vencimento pelo
  saldo devedor — some com o caixa realizado; (c) tudo no pagamento — some com a
  previsão do que ainda falta.
- **Consequência**: o total do período muda para meses com parciais que cruzam a
  virada. É a correção, não um efeito colateral.

### D-4 — "Ajustar saldo" pede o saldo atual, não o inicial

- **Escolha**: o campo é "Saldo atual na conta"; o inicial é deduzido por
  `atual − baixas` e a tela mostra o resultado antes de salvar.
- **Alternativas descartadas**: editar o saldo inicial direto — quem abre a tela
  está olhando o extrato do banco, não fazendo arqueologia de qual era o saldo
  quando cadastrou a conta.
- **Consequência**: o saldo calculado passa a bater com o extrato sem que nenhum
  lançamento seja inventado para "fechar a conta".

### D-5 — Corrigir rótulo e gerar série são ações separadas

- **Escolha**: os campos "Parcela X de Y" salvam junto com o resto do formulário;
  "Gerar parcelas seguintes" é um botão próprio, com o efeito descrito no texto
  ao lado.
- **Alternativas descartadas**: um select "Nx" que gerasse parcelas ao salvar,
  como no formulário de criação — salvar uma edição rotineira passaria a criar
  onze lançamentos sem aviso.
- **Consequência**: quem só quer arrumar "2/4" para "3/12" não corre risco de
  criar nada.

### D-6 — `computedBalance` derivado, `balance` intocado

- **Escolha**: expor um campo novo calculado, mantendo `balance` como saldo
  inicial digitado.
- **Alternativas descartadas**: passar a atualizar `balance` a cada baixa —
  mudaria o saldo de abertura da projeção (spec 0009) e o `<LEDGERBAL>` da
  conciliação (spec 0013) sem o usuário pedir, e não teria como ser desfeito.
- **Consequência**: a tela mostra dois números e a diferença entre eles passa a
  ser explicável, que é justamente o que faltava.

## 7. Impacto

- [ ] Schema / migration (`prisma/schema.prisma`)
- [x] Procedures oRPC (contrato de entrada/saída)
- [ ] Realtime (Pusher / event-bus)
- [ ] Automações (Inngest)
- [ ] Env vars novas
- [ ] Breaking change para clientes existentes
- [ ] Documentação obrigatória (CLAUDE.md itens 10 / 14 / 16)

Contrato: `payment.accounts.list` ganha três campos por conta (`settledIn`,
`settledOut`, `computedBalance`). Aditivo — nenhum consumidor existente quebra.
`payment.entries.update` passa a poder responder `BAD_REQUEST` com a mensagem do
saldo devedor.

Consome a mesma regra: as tools financeiras do Astro (spec 0014), que chamam
`updatePaymentEntryRecord` e `queryPaymentEntries` diretamente.
`list_payment_accounts` passa a devolver `balanceCents` = saldo calculado e ganha
`openingBalanceCents` para o inicial — o Astro respondia o saldo inicial como se
fosse o saldo de hoje.

`payment.entries.update` aceita `installmentTotal` e `installmentCurrent`, que a
procedure não expunha embora o serviço já tivesse o campo no patch. Nova
procedure `payment.entries.generateInstallments` (permissão `entries.create`).

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-2, CA-3 | manual | Editar lançamento pela tela e pelo Astro, conferir mensagem e registro resultante. |
| CA-4, CA-5 | manual | Aba Despesa em Setembro/2026 após corrigir os dois registros: "Total pendente" deve cair para R$ 5.241,91. |
| CA-6 | manual | Fluxo de Caixa de Setembro/2026: a saída de 20/09 deve deixar de contar o que já foi pago em 10/09. |
| CA-7 | manual | Aba Contas: saldo calculado deve se aproximar dos R$ 1.478,58 reais na medida em que os lançamentos tiverem conta vinculada. |
| CA-8 | manual | Painel e pergunta "saldo por conta" ao Astro devem repetir o número da aba Contas. |
| CA-9 | manual | Aba Contas → menu da conta → "Ajustar saldo": informar R$ 1.478,58 e conferir o saldo inicial resultante. |
| CA-10, CA-11, CA-12 | manual | Editar lançamento → "Mais opções" → Parcelas, nos três cenários. |

Sem teste automatizado: o projeto ainda não tem runner instalado (CLAUDE.md
item 20, deriva conhecida). Os critérios ficam registrados para quando houver.

## 9. Riscos e rollback

- **Risco 1** — CB-1 bloqueia a edição de registros legados incoerentes. É
  intencional, mas pode surpreender. Mitigação: a mensagem diz exatamente qual é
  o saldo e o que precisa mudar.
- **Risco 2** — o total do Fluxo de Caixa muda para meses fechados que tenham
  parciais. Não há perda de dado; o número anterior é que estava errado.
- **Rollback**: sem migration. Reverter o commit restaura o comportamento
  anterior integralmente.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-22 | Weydson | Criada a partir da auditoria de Setembro/2026 |
| 2026-09-22 | Weydson | RF-8/CA-8 acrescentados na implementação: o card do Painel e a tool do Astro liam `balance` direto e passariam a divergir da aba Contas |
| 2026-09-22 | Weydson | RF-9 a RF-11 (ajuste manual de saldo e parcelas no editar lançamento) pedidos depois da revisão da primeira entrega |
