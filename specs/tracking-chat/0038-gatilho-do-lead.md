---
id: 0038
titulo: Gatilho do lead — mensagem agendada com período de ativação
dominio: tracking-chat
status: implementada
autor: Weydson
criada: 2026-09-27
atualizada: 2026-09-27
branch: feature/W-tracking-chat-gatilho-do-lead-20260927
pr:
peso: completa
---

# 0038 — Gatilho do lead

## 1. Contexto

A aba "Comandos" da lateral do lead (spec 0034) só lista execuções do ASTRO e abre o
"Criar comando" genérico. Para o caso mais comum — "falar de novo com este lead daqui a
X dias" — o atendente precisa escrever uma instrução livre e torcer para o ASTRO entender.
Pedido do usuário (2026-09-27): cards-modelo prontos por lead, com liga/desliga, data e
hora fáceis, mensagem com o nome do lead e período de ativação.

## 2. Objetivo

Na lateral do lead, o atendente liga um card-modelo, escolhe quando e o que dizer, e a
mensagem sai no WhatsApp do lead sozinha, dentro da janela permitida.

### Não-objetivos

- Renomear "Comando" no ASTRO Commander ou no banco (decisão D-1).
- Recorrência sem fim: a repetição tem teto (até 30 vezes por ciclo).
- Outros canais além do WhatsApp do tracking do lead.

## 3. Requisitos

| ID | Requisito |
|---|---|
| RF-1 | Na lateral do lead, "Comandos" passa a se chamar **"Gatilho do lead"**, com o ícone de gatilho (setas circulares + raio). |
| RF-2 | O popup mantém **"Criar comando"** e ganha **"Gatilhos Automáticos"** (leva às automações do tracking do lead). |
| RF-3 | Abaixo, **cards-modelo**: Follow-up, Retorno combinado, Lembrete de pagamento, Pós-venda. Cada card tem: toggle de ativação (cinza desligado, verde ligado), quantas vezes já disparou, data e hora do 1º disparo, **repetição (1x, 2x, 3x…) e "a cada X dias"** (1, 2, 3, 5 dias, 1 semana, 15 dias, 1 mês), mensagem e período de ativação (horário de/até, dias da semana, **"apenas com as tags"**, "não disparar se o lead estiver em atendimento"). |
| RF-4 | A mensagem é **obrigatória e precisa conter `{nome}`**, trocado pelo primeiro nome do lead no envio. Sem `{nome}` o card não salva. Digitar **"/"** abre as variáveis: `{nome}`, `{nome_completo}`, `{telefone}`, `{email}`, `{responsavel}`. |
| RF-5 | Ligado e na hora marcada, o gatilho envia a mensagem pelo WhatsApp do tracking do lead. Fora da janela (horário/dia) ou com o lead em atendimento (`statusFlow = ACTIVE`, se a opção estiver marcada), adia para a próxima abertura da janela. |
| RF-6 | Depois de disparar: soma 1 nas ativações e no ciclo. Se o ciclo ainda não completou as repetições, reagenda para daqui a X dias (ajustado à janela); senão, desliga. Ligar de novo começa um ciclo novo. Lead sem nenhuma das tags exigidas não recebe; confere de novo em 1 h. |
| RF-7 | No card da conversa na lista do chat, um ícone de gatilho aparece na linha de ícones de baixo quando o lead tem gatilho; **as setas giram** enquanto houver um gatilho ligado. |
| RF-8 | "Automações" do tracking (menu e página `/tracking/[id]/workflows`) passa a se chamar **"Gatilhos Automáticos"**. |
| RNF-1 | O disparo reserva o gatilho de forma atômica (`updateMany` com `nextRunAt` antigo): duas execuções do cron (produção + Inngest local no mesmo banco) não enviam duas vezes. |
| RNF-2 | Envio e I/O fora de transação (Regra 18). Falha de envio não desliga o gatilho: registra o erro e tenta na próxima rodada, até 3 vezes. |
| RNF-3 | Cron a cada 5 minutos; consulta por índice (`isActive`, `nextRunAt`). |

## 4. Critérios de aceite

- [x] **CA-1** — Card salvo sem `{nome}` na mensagem é recusado com aviso.
- [ ] **CA-2** — Gatilho ligado com horário vencido e dentro da janela envia uma vez, soma 1 e desliga.
- [x] **CA-3** — Fora da janela, não envia e reagenda para a próxima abertura.
- [x] **CA-4** — Com "não disparar em atendimento" e o lead em atendimento, não envia.
- [x] **CA-5** — Duas rodadas simultâneas do cron enviam uma vez só.
- [x] **CA-6** — Com "apenas com as tags" e o lead sem nenhuma delas, não envia e confere de novo em 1 h.

## 5. Decisões

- **D-1 — Renome só no contexto do lead** (usuário, 2026-09-27): o ASTRO Commander continua "Comando"; banco sem rename.
- **D-2 — Envia a mensagem ao lead** (usuário, 2026-09-27).
- **D-3 — Ícone na linha de baixo do card** (usuário, 2026-09-27); o ícone de origem continua.
- **D-4 — Só "Automações" do tracking** vira "Gatilhos Automáticos" (usuário, 2026-09-27).
- **D-5 — Tabela própria `lead_triggers`**, não `AstroCommand`: o gatilho é por lead, sem agente nem Stars; misturar obrigaria todo comando a carregar campos de lead.

## 6. Modelo

`LeadTrigger`: `organizationId`, `leadId` (cascade), `createdById`, `template` (enum
`LeadTriggerTemplate`), `title`, `message`, `isActive`, `scheduledAt`, `nextRunAt`,
`windowStart`/`windowEnd` ("HH:mm"), `weekdays` (Int[], 0 = domingo), `skipWhenInService`,
`repeatEveryDays`, `maxRepetitions`, `cycleFireCount`, `tagIds`, `activationCount`, `lastFiredAt`, `lastError`, `failureCount`. Um por lead e modelo
(`@@unique([leadId, template])`). Índices: `[isActive, nextRunAt]`, `[leadId]`.

## 9. Changelog

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-27 | Weydson | Criada a partir do pedido e das decisões D-1 a D-4. |
| 2026-09-27 | Weydson | Implementada. CA-1, 3, 4 e 5 conferidos por `scripts/astro-qa/check-lead-triggers.ts` na org de QA (sem WhatsApp: o envio falha de propósito e mostra uma tentativa só). CA-2 (envio real) pendente de um tracking de teste com WhatsApp conectado. |
| 2026-09-27 | Weydson | Pedido do usuário: "Em quanto tempo" vira "a cada X dias" com repetição (1x, 2x, 3x…); período ganha "apenas com as tags"; mensagem ganha variáveis por "/"; card cinza quando desligado e mais baixo. Migration `20260927140000_lead_triggers_repeat_tags`. |
| 2026-09-27 | Weydson | Visual: contorno com luz percorrendo a borda quando ligado, vermelho com lógica quebrada (erro no último disparo, mensagem sem `{nome}` ou nenhum dia); botão "Gatilho do lead" da lateral no verde do popup; ícone de gatilho do card do chat abre o popup (`?leadScreen=leadTriggers`). "Criar comando" passa a abrir o construtor rápido (spec 0039). |
