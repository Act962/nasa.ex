---
id: 0102
titulo: Lembrete mensal não pula mês curto
dominio: tracking-chat
status: em-revisao
autor: João Gabriel
criada: 2026-10-13
atualizada: 2026-10-13
branch: claude/architecture-audit-modernization-0f66d6
pr: https://github.com/Act962/nasa.ex/pull/459
peso: leve
---

# 0102 — Lembrete mensal não pula mês curto

## 1. Contexto

Achado pela primeira suíte de testes do projeto (`src/lib/reminder-recurrence.test.ts`).

Um lembrete mensal criado **sem dia fixo**, com data de início nos dias 29, 30 ou 31, deixa de
disparar no mês seguinte quando esse mês não tem o dia, e a partir daí muda de dia para sempre:

| Início | Deveria disparar | Dispara hoje |
| --- | --- | --- |
| 31/01 | 28/02, 31/03, 30/04 | 03/03, 03/04, 03/05 |
| 30/01 | 28/02, 30/03 | 02/03, 02/04 |
| 31/03 | 30/04, 31/05 | 01/05, 01/06 |

Causa: `addOneMonth` soma um mês mantendo o dia, e `Date.UTC(2026, 1, 31)` não falha: transborda
para 03/03. O limite ao último dia do mês existia, mas só era aplicado depois, já sobre o mês errado.

O caminho com **dia fixo** tem o mesmo defeito, mas hoje é inalcançável: a tela, a procedure e a ação
do Astro limitam o dia fixo a 1–28. `buildFirstRemindAt` transborda do mesmo jeito (dia 31 pedido em
abril agenda 01/05), também inalcançável pelo mesmo limite.

Não há como saber, sem consultar produção, quantos lembretes foram afetados.

## 2. Objetivo

Lembrete mensal dispara todo mês, no dia em que foi criado ou, quando o mês não tem esse dia, no
último dia do mês, voltando ao dia original no mês seguinte.

### Não-objetivos

- Liberar dia fixo 29–31 na tela (continua 1–28).
- Corrigir lembretes que já mudaram de dia em produção (ver §9, decisão pendente).
- Mudar recorrência semanal ou quinzenal.

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | A próxima ocorrência mensal é sempre no mês seguinte ao da ocorrência atual, nunca dois meses à frente |
| RF-2 | O dia da ocorrência é o dia de referência do lembrete, limitado ao último dia do mês |
| RF-3 | Lembrete mensal criado sem dia fixo grava como dia de referência (`dayOfMonth`) o dia, em BRT, da data de início |
| RF-4 | Lembrete mensal sem `dayOfMonth` gravado (criado antes desta spec) usa o dia da ocorrência atual como referência |
| RF-5 | O primeiro disparo com dia fixo inexistente no mês corrente cai no último dia desse mês |

## 4. Critérios de aceite

- [x] **CA-1** — Dado lembrete mensal com dia de referência 31 e ocorrência em 31/01, a próxima é 28/02 (29/02 em ano bissexto).
- [x] **CA-2** — Dado o mesmo lembrete com ocorrência em 28/02, a próxima é 31/03: o dia original volta.
- [x] **CA-3** — Dado dia de referência 31 e ocorrência em 31/03, a próxima é 30/04.
- [x] **CA-4** — Dado lembrete mensal em 31/12, a próxima é 31/01 do ano seguinte.
- [x] **CA-5** — Dado lembrete mensal criado sem dia fixo com início em 31/01, o dia de referência gravado é 31.
- [x] **CA-6** — Dado lembrete que não é mensal, nenhum dia de referência é derivado da data de início.
- [x] **CA-7** — Dado dia fixo 31 pedido em abril, antes do dia 30, o primeiro disparo é 30/04.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Lembrete antigo, mensal, sem `dayOfMonth`, ocorrência em 31/01 | Próxima em 28/02 (não pula mais). Depois segue no dia 28: sem dia de referência gravado não há como saber que era 31 |
| CB-2 | Lembrete antigo que já mudou de dia pelo defeito (hoje no dia 3) | Continua no dia 3. O dia original não está na linha do lembrete |
| CB-3 | Horário 22:30 BRT (já é o dia seguinte em UTC) | O dia de referência e a conta do mês usam a data em BRT |
| CB-4 | Dia fixo informado pelo usuário (1–28) | Sem mudança de comportamento |
| CB-5 | Dia de referência gravado em lembrete que não é mensal (a procedure aceita) | Ignorado no cálculo da próxima ocorrência, como já era |
| CB-6 | Dia fixo cujo último dia válido do mês já passou (31 pedido em 30/04 à noite) | Primeiro disparo em 31/05 |

## 9. Riscos e rollback

Mudança só em função pura e em dois pontos de criação; sem migration. Reverter o commit restaura o
comportamento anterior. Lembretes criados depois desta spec passam a ter `dayOfMonth` preenchido com
29–31 em alguns casos; o código anterior, se restaurado, lê esse valor sem erro (cai no caminho de
dia fixo, com o defeito antigo).

**Decisão pendente — dados de produção.** Lembretes mensais antigos sem `dayOfMonth` param de pular
meses com esta correção, mas (a) os que estão em dia 29–31 vão descer para o último dia do primeiro
mês curto e ficar nele, e (b) os que já mudaram de dia pelo defeito continuam no dia errado. Dá para
reparar os dois grupos com uma migration de dados: o dia original está na primeira ocorrência
registrada em `reminder_occurrences`. Não foi feita aqui porque altera dados de produção.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-13 | João Gabriel | Criada junto com a correção |
| 2026-10-13 | João Gabriel | Renumerada de 0074 para 0090: o número já estava em uso na `main` |
| 2026-10-13 | João Gabriel | Renumerada de 0090 para 0102: a primeira renumeração conferiu só até 0089 e colidiu de novo com a `main` |
