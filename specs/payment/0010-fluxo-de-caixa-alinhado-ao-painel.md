---
id: 0010
titulo: Alinhar Fluxo de Caixa ao Painel Financeiro
dominio: payment
status: implementada
autor: Weydson
criada: 2026-09-14
atualizada: 2026-09-14
branch: feature/W-trafego-self-service-20260908
pr:
peso: leve
---

# 0010 — Alinhar Fluxo de Caixa ao Painel Financeiro

---

## 1. Contexto

Em produção (`orbita.nasaex.com/payment`), com os filtros "Setembro 2026" e
"Todas as categorias", o Painel e a aba Fluxo de Caixa contavam histórias
diferentes:

| Onde | Valor observado |
| --- | --- |
| Card "RECEITA" | R$ 12.705,77 |
| Card "FATURAMENTO" | R$ 7.407,88 |
| Fluxo de Caixa → Total Entradas | R$ 20.113,65 |
| Card "DESPESA" | R$ 5.964,00 |
| Card "GASTOS DO PERÍODO" | R$ 4.603,20 |
| Fluxo de Caixa → Total Saídas | R$ 10.107,20 |

Três problemas distintos saíram dessa conferência:

1. **Rótulo enganoso.** Os cards "Receita"/"Despesa" mostram apenas o que está
   em aberto (`PENDING`/`PARTIAL`/`OVERDUE` por vencimento), mas o nome sugere
   o total do mês. Quem lê "Receita de setembro" espera R$ 20.113,65 — que é,
   inclusive, o alvo exibido na "Meta do mês".
2. **Eixo de data divergente.** O painel conta o realizado por `paidAt`
   (`dashboard.ts:140`) e o Fluxo de Caixa filtrava tudo por `dueDate`
   (`dashboard.ts:338`). Uma despesa vencida em agosto e paga em setembro
   entrava nos "Gastos do período" e sumia do fluxo de setembro — daí os
   R$ 460,00 que faltavam nas saídas (5.964,00 + 4.603,20 = 10.567,20 ≠
   10.107,20). O valor coincide com "Pgto. Comissões" no gráfico de categorias.
3. **Datas um dia atrás na tabela.** `cashflow-tab.tsx:142` fazia
   `new Date("2026-09-01").toLocaleDateString("pt-BR")`; o JS lê a string como
   meia-noite UTC e o fuso -03 exibe 31/08/2026. A tabela de setembro abria com
   uma linha de agosto, e a linha rotulada "14/09 — R$ 9.805,77" era na verdade
   15/09 (confirmado contra os vencimentos 15/09 listados no painel).

## 2. Objetivo

Entradas e saídas do Fluxo de Caixa fecham com os cards do Painel para o mesmo
período e filtro de categoria, e as datas exibidas são as reais.

### Não-objetivos

- Rever a definição de "Faturamento" ou o drill-down dos cards (`statuses:
  ["PAID","PARTIAL"]` enquanto o agregado soma só `PAID`) — inconsistência
  menor, separada desta.
- Separar visualmente realizado de previsto dentro do Fluxo de Caixa.
- Tratar o corte do dia 1º: o período chega como `2026-09-01T03:00:00Z` e um
  lançamento gravado à meia-noite UTC ficaria de fora. `lib/dates.ts` já grava
  ao meio-dia UTC desde a correção anterior; registros antigos não foram
  auditados.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | No Fluxo de Caixa, lançamento `PAID` entra pela data de `paidAt` e pelo valor de `paidAmount` |
| RF-2 | No Fluxo de Caixa, lançamento em aberto entra pela data de `dueDate` e pelo valor de `amount` |
| RF-3 | "Em aberto" no Fluxo de Caixa usa os mesmos status do Painel: `PENDING`, `PARTIAL`, `OVERDUE` |
| RF-4 | A coluna Data da tabela exibe o dia de calendário do lançamento, sem deslocamento por fuso |
| RF-5 | Os cards de valor em aberto se chamam "A receber" e "A pagar" |
| RF-6 | Clicar numa linha da tabela abre os lançamentos que compõem aquele dia |
| RF-7 | O detalhe do dia usa a **mesma** regra que produziu o total da linha |

## 4. Critérios de aceite

- [x] **CA-1** — Dado o mesmo período e filtro de categoria, Total Entradas do
      Fluxo de Caixa é igual a "A receber" + "Faturamento" do Painel.
- [x] **CA-2** — Dado o mesmo período e filtro, Total Saídas é igual a
      "A pagar" + "Gastos do período". Para setembro/2026: R$ 10.567,20.
- [x] **CA-3** — Dada uma despesa vencida em agosto e paga em setembro, ela
      aparece no Fluxo de Caixa de setembro, no dia do pagamento.
- [x] **CA-4** — Dado o filtro "Setembro 2026", nenhuma linha da tabela exibe
      data de agosto ou de outubro.
- [x] **CA-5** — Dada uma receita com vencimento em 15/09, a tabela a exibe em
      15/09 e não em 14/09.
- [x] **CA-6** — Dado um clique numa linha, abre a lista dos lançamentos daquele
      dia, separando entradas de saídas.
- [x] **CA-7** — Para todo dia da tabela, a soma do detalhe é idêntica ao total
      da linha — inclusive em dias com vários lançamentos.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | `PAID` com `paidAt` nulo (dado legado) | Cai para `dueDate`; não some do fluxo |
| CB-2 | Vence em setembro, pago em outubro | Sai do fluxo de setembro e entra no de outubro — mudança de comportamento intencional |
| CB-3 | `CANCELLED` | Continua fora, como antes |
| CB-4 | `PENDING_APPROVAL` | Passa a ficar **fora** do fluxo; antes entrava via `notIn: ["CANCELLED"]`. Alinha com o Painel, que nunca o contou |
| CB-5 | `PARTIAL` | Entra pelo `amount` cheio no vencimento, igual ao Painel. Não rateia o já recebido |
| CB-7 | Lançamento recebido parcialmente | O detalhe mostra o valor que entrou no fluxo (o previsto) e, abaixo, o total do lançamento — os dois são diferentes e a tela diz qual é qual |
| CB-6 | Pagamento registrado após 21h (BRT) | `toISOString()` joga para o dia seguinte. Desvio aceito: é o mesmo critério UTC já usado no eixo do gráfico e em `formatCalendarDate` |

## 6. Decisões de design

### D-1 — Regime de caixa no Fluxo de Caixa, sem separar previsto de realizado

- **Escolha**: um `OR` no `where` — `PAID` por `paidAt`, aberto por `dueDate`.
- **Alternativas descartadas**: (a) alinhar o Painel ao `dueDate` — quebraria
  "Faturamento" e "Gastos do período", que são deliberadamente caixa realizado;
  (b) duas séries separadas na tabela (realizado vs. previsto) — resolve melhor,
  mas é redesenho de tela, não conciliação de números.
- **Consequência**: CB-2 muda o total de meses já fechados. O número novo é o
  correto, mas quem tiver print do anterior verá diferença.

### D-3 — O detalhe do dia reusa o `where` do total

- **Escolha**: `cashflowWhere()` extraída em `dashboard.ts` e usada tanto pelo
  `getCashflow` quanto pelo `getCashflowDayEntries`, este com janela de um dia.
- **Alternativa descartada**: reusar o `KpiEntriesDialog` do Painel, que filtra
  por um período só. Um dia do fluxo mistura duas regras — pagos por `paidAt` e
  em aberto por `dueDate` — e o dialog do Painel não expressa esse `OR`. Abrir
  uma lista que não soma o número clicado é pior do que não abrir lista.
- **Consequência**: uma procedure a mais, com a garantia estrutural de que
  detalhe e total nunca divergem.

### D-2 — Renomear o card em vez de trocar o que ele mede

- **Escolha**: "Receita"/"Despesa" viram "A receber"/"A pagar".
- **Alternativas descartadas**: fazer o card somar aberto + realizado — viraria
  duplicata da "Meta do mês" e deixaria o módulo sem visão de em-aberto.
- **Consequência**: o Painel passa a ter nome coerente com o `hint` que já
  estava lá ("Em aberto no período").

## 7. Impacto

- [x] Procedures oRPC (`getCashflow` — comportamento; contrato inalterado)
- [ ] Schema / migration
- [ ] Realtime
- [ ] Automações
- [ ] Env vars novas
- [ ] Breaking change para clientes existentes
- [ ] Documentação obrigatória (CLAUDE.md itens 10 / 14 / 16)

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-2 | manual | Abrir `/payment` com Setembro 2026 + Todas as categorias e comparar os totais das duas abas |
| CA-3 | manual | Localizar a despesa de R$ 460,00 (Pgto. Comissões) e conferir que aparece no dia do pagamento |
| CA-4, CA-5 | manual | Conferir a primeira e a última linha da tabela contra os vencimentos do Painel |

> Sem cobertura automatizada: o projeto ainda não tem runner de teste instalado
> (CLAUDE.md item 20). Assim que houver, estes critérios viram testes citando
> `CA-n` no nome.

## 9. Riscos e rollback

Nenhuma migration. O risco é CB-2: totais de meses passados podem mudar para
quem pagou fora do mês de vencimento. Rollback é reverter o commit — os dados
não são tocados, só a leitura.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-14 | Weydson | Criada já implementada, a partir da conferência em produção |
