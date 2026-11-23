---
id: 0147
titulo: Um caminho só para calcular horário livre e gravar compromisso
dominio: agenda
status: implementada
autor: João Gabriel
criada: 2026-11-16
atualizada: 2026-11-16
branch: feature/external-ai-mcp-agenda-20261116
pr:
peso: leve
---

# 0147 — Um caminho só para calcular horário livre e gravar compromisso

## Problema

Ao levar a Agenda para o MCP ([spec 0146](../external-ai/0146-agenda-pelo-mcp.md)), oito lugares gravavam compromisso
cada um com o seu `prisma.appointment.create`, e havia dois cálculos de horário livre:

- O do chat de agendamento público e da IA do WhatsApp (`listAgendaFreeSlots`) ignorava a disponibilidade por data e
  usava o fuso do servidor: o cliente via horário diferente da página pública, ou marcava num dia de expediente
  especial com o horário da semana.
- A barra de comandos (`nasa-command`) marcava sem conferir conflito: dois compromissos no mesmo horário.
- Nenhum caminho travava a corrida: dois pedidos no mesmo instante marcavam o mesmo horário.
- O chat de agendamento criava o lead na primeira coluna do funil, ignorando a coluna e as etiquetas configuradas na
  agenda (a página pública e a tela respeitam).

## Solução

- **Horário livre**: `listAgendaFreeSlots` passou para `features/agenda/server/agenda-slots.ts` e usa
  `computeAgendaTimeSlots`, o cálculo da página pública. Mesmo formato de resposta para o modelo.
- **Gravar compromisso**: `insertAgendaAppointment` (`features/agenda/server/appointment-commands.ts`) confere conflito
  e grava numa transação serializável; o conflito de escrita (P2034) volta como horário ocupado. Usado por: tela
  (`createAdmin`), página pública, chat de agendamento, IA do WhatsApp, Astro (ação e ferramenta antiga), barra de
  comandos e MCP.
- **Lead do agendamento**: `findOrCreateAgendaLead` (mesmo arquivo) acha pelo telefone no funil da agenda ou cria na
  coluna da agenda com as etiquetas dela. Usado pela tela, página pública, chat de agendamento e MCP. Cada caminho
  continua com os seus efeitos (origem e UTM na página pública, inatividade no chat).
- Cada caminho mantém o próprio status (pendente ou confirmado), avisos, Google Agenda e lembretes.

## Fora

- O Astro continua aceitando duração e horário livres (compromisso pessoal, não horário de atendimento); só passou a
  gravar pelo núcleo.
- O evento de campanha do Planner refletido na agenda (`nasa-planner/create-campaign-event.ts`) não é agendamento de
  cliente e segue sem conferir conflito: aplicar a regra faria o evento sumir da agenda sem aviso.
- Remarcar e cancelar dos outros caminhos (chat, IA do WhatsApp, Astro) não foram unificados.

## Critérios de aceite (conferidos no banco local)

- **CA-1**: o horário livre do chat e da IA do WhatsApp respeita a disponibilidade da data (quinta com 14h–15h devolve
  14:00 e 15:00, não o horário da semana), o dia bloqueado e recusa data passada.
- **CA-2**: três gravações simultâneas no mesmo horário gravam um compromisso só.
- **CA-3**: lead novo do agendamento cai na coluna e com as etiquetas da agenda; o mesmo telefone reaproveita o lead.
- **CA-4**: a página pública marca como antes (pendente, mesma mensagem de horário ocupado).
- **CA-5**: a barra de comandos recusa horário ocupado.

Não conferido em execução: chat de agendamento, IA do WhatsApp, Astro e barra de comandos (dependem do modelo de IA
ou da tela); tipos e lint passam.
