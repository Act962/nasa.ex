---
id: 0146
titulo: Ver horários e marcar compromissos da Agenda pelo MCP do ÓRBITA
dominio: external-ai
status: implementada
autor: João Gabriel
criada: 2026-11-16
atualizada: 2026-11-16
branch: feature/external-ai-mcp-agenda-20261116
pr:
peso: completa
---

# 0146 — Ver horários e marcar compromissos da Agenda pelo MCP do ÓRBITA

## 1. Contexto

Depois do Tracking ([spec 0145](0145-tracking-pelo-mcp.md)), o pedido seguinte à IA é de agenda: "o que tenho amanhã",
"quais horários livres na quinta", "marca a Maria às 15h". A Agenda tem agendas por empresa, disponibilidade por dia da
semana ou por data, dias bloqueados e compromissos ligados a um lead.

Ao mapear o módulo: há seis lugares que criam compromisso, cada um com o seu `prisma.appointment.create`, e dois cálculos
de horário livre. O da página pública respeita dia bloqueado, disponibilidade por data e o fuso de Brasília; o do
chat de agendamento e da IA do WhatsApp (`listAgendaFreeSlots`) ignora os dois últimos.

## 2. Objetivo

Pela IA, a pessoa lista as agendas, vê horários livres e os compromissos de um período, marca, remarca e cancela, com as
regras e os efeitos da tela, sem criar um sétimo caminho de agendamento.

### Não-objetivos

- Mexer na configuração da agenda (horários, bloqueios, criar ou apagar agenda).
- Apagar compromisso, marcar como realizado ou não compareceu.
- Sincronizar com o Google Agenda e lembretes ao cliente (a tela de marcar também não faz).
- Unificar os outros cinco caminhos de agendamento (tarefa separada, seção 7).

## 3. Requisitos

### Funcionais

- **RF-1 — App novo no MCP**: entrada `agenda` em `MCP_APPS`, liberada a quem pode ver a Agenda (app `spacetime` na
  matriz de permissões da empresa) em alguma empresa que tenha agenda ativa. Chave nova ganha o escopo `agenda`; chave
  antiga não. Na chave, só as empresas gravadas nela.
- **RF-2 — Permissão**: a mesma matriz que o Astro usa para a Agenda (`resolveOrgPermissions` + `isOrgActionAllowed`,
  app `spacetime`): ver para ler, `create` para marcar, `edit` para remarcar, `delete` para cancelar.
- **RF-3 — Ferramentas**:

  | Ferramenta | O que faz |
  | --- | --- |
  | `agenda_list_agendas` | Agendas ativas das empresas, com duração do horário, responsáveis e funil |
  | `agenda_list_free_slots` | Horários livres de uma agenda, dia a dia, por até 14 dias |
  | `agenda_list_appointments` | Compromissos de um período (até 62 dias), de uma agenda ou de todas, com o lead |
  | `agenda_create_appointment` | Marca num horário livre, para um lead que já existe ou por nome e telefone |
  | `agenda_reschedule_appointment` | Muda para outro horário livre da mesma agenda |
  | `agenda_cancel_appointment` | Cancela |

- **RF-4 — Só horário livre**: marcar e remarcar exigem um horário oferecido por `computeAgendaTimeSlots` naquele dia
  (dentro da disponibilidade, não bloqueado, não ocupado, não passado). Fora disso, recusa e sugere os livres do dia.
- **RF-5 — Mesmos efeitos da tela**: marcar, remarcar e cancelar passam pelas funções que as rotas da tela usam (D-1):
  conflito de horário, lead achado pelo telefone ou criado no funil da agenda com as etiquetas dela, histórico de
  atividades, Stars ao marcar e o acompanhamento do atendimento (`recordAppointmentChange`).
- **RF-6 — Fuso**: datas e horas em Brasília (`America/Sao_Paulo`), como a tela. As respostas trazem data e hora já no
  fuso.
- **RF-7 — Instruções do app**: confirmar com o usuário antes de marcar, remarcar ou cancelar (o compromisso pode
  disparar o acompanhamento do atendimento, que fala com o cliente nas empresas com ele ligado).

### Não-funcionais

- **RNF-1**: nenhuma tabela, migration, flag ou função do Inngest.
- **RNF-2**: as rotas `agenda.appointments.createAdmin/reschedule/cancel` e `agenda.public.getTimeSlots` mudam só de
  lugar (CA-8).

## 4. Critérios de aceite

- **CA-1**: "quais horários livres na quinta na agenda X" devolve os mesmos horários da página pública da agenda.
- **CA-2**: marcar num horário livre cria o compromisso confirmado, ligado ao lead; o horário some dos livres.
- **CA-3**: marcar num horário ocupado, bloqueado, fora da disponibilidade ou passado é recusado com os livres do dia.
- **CA-4**: remarcar para horário livre funciona; para ocupado, recusa.
- **CA-5**: cancelar muda para cancelado e libera o horário.
- **CA-6**: sem permissão de criar na Agenda, marcar é recusado.
- **CA-7**: chave antiga não recebe as ferramentas `agenda_*`.
- **CA-8**: na tela, marcar, arrastar para remarcar, cancelar e a página pública de horários continuam iguais.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Telefone de um lead que já existe no funil da agenda | Usa o lead que existe, como a tela. |
| CB-2 | `leadId` de outra empresa | "Lead não encontrado". |
| CB-3 | Agenda inativa | Não aparece e não aceita marcar. |
| CB-4 | Cancelar o que já está cancelado | Recusa com a mensagem da tela. |

## 6. Decisões de design

### D-1 — Marcar, remarcar e cancelar viram funções do domínio

- `features/agenda/server/appointment-commands.ts`. As rotas da tela passam a só chamá-las.

### D-2 — Um cálculo de horário livre: o da página pública

- `computeAgendaTimeSlots` em `features/agenda/server/agenda-slots.ts`, extraído de `public/get-timeslots.ts`.

## 7. Dívida e pendências

- Os outros caminhos de agendamento, o cálculo de horário livre do chat e da IA do WhatsApp e a corrida de dois
  agendamentos no mesmo instante foram resolvidos na [spec 0147](../agenda/0147-um-caminho-de-agendamento.md).
- `computeAgendaTimeSlots` (e a página pública) só marca como passado o horário de hoje: dia anterior aparece livre. O
  MCP recusa data passada antes; a página pública continua como está.
- O texto do histórico ao remarcar mostrava a hora no fuso do servidor; passou a usar o de Brasília.

## Changelog

- 2026-11-16 — criada.
- 2026-11-16 — testada de ponta a ponta no banco local pelo `/api/mcp`, numa empresa descartável: CA-2 a CA-7
  conferidos (horários livres, marcar, ocupado/fora do expediente/dia bloqueado/passado recusados, remarcar, cancelar
  libera o horário, membro só com ver recusado, chave antiga sem as ferramentas, histórico com o nome da IA e hora de
  Brasília). CA-1 vale por construção (mesma função da página pública); CA-8 (tela) não conferido.
