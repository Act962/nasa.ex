---
id: 0100
titulo: Atendimento do Astro — formulário respondido, link do formulário, menu, limite da chamada e e-mail do agendamento
dominio: tracking-chat-ai
status: em-revisao
autor: Weydson
criada: 2026-10-12
atualizada: 2026-10-12
branch: feature/W-atendimento-astro-formulario-chamada-email-20261012
pr:
peso: completa
---

# 0100 — Atendimento do Astro: o que faltou no teste real da ÓRBITA HUB

## 1. Contexto

Em 12/10/2026 montamos em produção o atendimento da ÓRBITA HUB (funil ATENDIMENTO ÓRBITA, número oficial): menu inicial, "Falar com consultor" com formulário de qualificação, agenda do consultor, áudio e site. O teste real pelo WhatsApp mostrou seis pontos em que o sistema não entrega o que o atendimento precisa:

1. **Link do formulário dá 404.** A ferramenta `get_form_link` do atendimento devolve `…/formulario/<shareUrl>?lead=<id>`. Essa rota não existe na parte pública (`curl` em produção: 404). A rota pública é `/submit-form/<formId>` (200). O mesmo endereço errado está em `src/features/astro/actions/form/send-to-lead.ts` e em `src/app/router/ia/ai-tracking/tools/auto-agent-send-tools.ts`.
2. **Formulário respondido não avisa ninguém.** Quando um contato que já existe envia o formulário, o sistema grava resposta, tags e jornada, mas não dispara nenhum fluxo. As tags das respostas são gravadas direto na tabela, sem passar pelo disparo de "Lead com Tag". O Astro só volta a falar se o cliente mandar mensagem.
3. **"menu" é ignorado em silêncio.** Depois de enviar um menu, `handleScriptMenu` ignora qualquer saudação ou pedido de menu por 2 minutos (`MENU_COOLDOWN_MS`). No teste: menu às 15:16, "Menu" às 15:17, sem resposta.
4. **Limite da chamada é fixo.** `MAX_CALL_MS` vale 10 minutos para qualquer chamada. A empresa quer oferecer um teste de chamada de 2 minutos.
5. **Agendamento não manda e-mail.** `booking-notification` envia só WhatsApp.
6. **Confirmação de agendamento não sai em número oficial.** `booking-notification` exige `whatsappInstance.status === "CONNECTED"`. Em número da API oficial esse campo fica `DISCONNECTED` mesmo com o número funcionando (caso real: o funil da ÓRBITA HUB respondeu mensagens e áudio com o campo em `DISCONNECTED`).

## 2. Objetivo

O atendimento por menu funciona de ponta a ponta em número oficial: o link do formulário abre, o fluxo continua sozinho quando o cliente responde o formulário, "menu" sempre devolve o menu, a empresa escolhe quanto dura a chamada e o cliente recebe a confirmação do agendamento por WhatsApp e por e-mail.

### Não-objetivos

- Gatilho novo "Formulário respondido" (tipo de quadro novo). Reaproveitamos "Lead com Tag".
- Levar as respostas do formulário para dentro do texto do fluxo (`{{form.campo}}`).
- Ligar em produção as chaves `NEXT_PUBLIC_WORKFLOW_FORM_CHAT` e `NEXT_PUBLIC_WORKFLOW_META_INTERACTIVE`.
- Corrigir o campo `status` da instância oficial (fica para o domínio WhatsApp Oficial).
- Tela para editar o menu dos números internos.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Todo link de formulário enviado pelo Astro (atendimento, comando interno e agente do funil) aponta para `/submit-form/<formId>?leadToken=<publicToken do lead>`. |
| RF-2 | Com `FORM_ANSWER_TAGS_TRIGGER_FLOWS=true`, ao enviar um formulário, as tags das respostas disparam os fluxos "Lead com Tag" ligados do funil do lead, depois do commit. |
| RF-3 | Sem a variável, o envio do formulário se comporta exatamente como hoje. |
| RF-4 | Quando o cliente escreve um pedido explícito de menu ("menu", "início", "começar", "opções"), o menu é enviado mesmo dentro dos 2 minutos. Saudação repetida ("oi", "bom dia") continua sem gerar segundo menu. |
| RF-5 | O funil guarda a duração máxima da chamada do cliente, de 1 a 10 minutos (`capabilities.voiceCallMaxMinutes`, padrão 10). |
| RF-6 | A chamada do cliente encerra ao atingir a duração configurada. O aviso de encerramento sai 1 minuto antes; em chamada de 1 minuto, aos 30 segundos. |
| RF-7 | A instrução de voz informa ao Astro a duração máxima, para ele poder dizer isso ao cliente. |
| RF-8 | A tela "O que o Astro pode fazer" mostra o campo de duração quando "Atender chamadas" está ligado. |
| RF-9 | Ao criar ou cancelar um agendamento, se o lead tem e-mail, o sistema envia um e-mail com data, hora, agenda e o link público do agendamento. |
| RF-10 | A confirmação por WhatsApp do agendamento sai em número da API oficial mesmo com o campo `status` em `DISCONNECTED`. |
| RF-11 | Contato que já existe e está sem e-mail guarda o e-mail informado no formulário; e-mail já cadastrado nunca é trocado. O atendimento é avisado de que o contato tem e-mail e não pede de novo. |
| RF-12 | Agendamento marcado pelo Astro na conversa nasce `CONFIRMED`, porque o cliente confirmou agenda, data e horário antes. |
| RF-13 | Com Google conectado com permissão de Calendário, o agendamento marcado pelo Astro cria o evento no Google Agenda; em reunião on-line o evento ganha link do Meet e o Astro envia esse link na confirmação. Com e-mail no lead, o Google envia o convite. |
| RF-14 | O lembrete do atendimento aceita 30 minutos antes. O lembrete enviado por WhatsApp repete o link da reunião, e o evento do Google usa o mesmo prazo de lembrete. |
| RF-15 | Remarcar pelo Astro move o evento do Google para o novo horário; cancelar remove o evento. Os convidados são avisados pelo Google. |
| RF-16 | Sem Google conectado, ou se o Google recusar, o agendamento acontece normalmente, sem link do Meet. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhum disparo de fluxo ou envio de e-mail acontece dentro de `prisma.$transaction` (regra 18). |
| RNF-2 | Falha no disparo de fluxo ou no e-mail não invalida o envio do formulário nem o agendamento. |
| RNF-3 | Sem migration. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um formulário publicado liberado no atendimento, quando o Astro envia o link, então o endereço é `/submit-form/<formId>?leadToken=…` e responde 200.
- [ ] **CA-2** — Dado um lead existente e um fluxo ligado com "Lead com Tag" na tag X, com a variável ligada, quando o lead envia um formulário cuja resposta carrega a tag X, então o fluxo é disparado uma vez.
- [ ] **CA-3** — Dado o mesmo cenário sem a variável, quando o formulário é enviado, então nenhum fluxo é disparado.
- [ ] **CA-4** — Dado um menu enviado há menos de 2 minutos, quando o cliente escreve "menu", então o menu é enviado de novo.
- [ ] **CA-5** — Dado um menu enviado há menos de 2 minutos, quando o cliente escreve "oi", então nenhum menu novo é enviado.
- [ ] **CA-6** — Dado `voiceCallMaxMinutes = 2`, quando o cliente liga, então o aviso sai com 1 minuto e a chamada encerra com 2 minutos.
- [ ] **CA-7** — Dado um funil sem o campo salvo, quando o cliente liga, então o limite é 10 minutos, como hoje.
- [ ] **CA-8** — Dado um lead com e-mail, quando um agendamento é criado, então um e-mail com data, hora e link é enviado para esse e-mail.
- [ ] **CA-9** — Dado um lead sem e-mail, quando um agendamento é criado, então nenhum e-mail é enviado e a confirmação por WhatsApp segue normal.
- [ ] **CA-10** — Dado um funil com número oficial e `status = DISCONNECTED`, quando um agendamento é criado dentro da janela de 24 h, então a confirmação por WhatsApp é enviada.

- [ ] **CA-11** — Dado um contato existente sem e-mail, quando ele envia um formulário com e-mail, então o contato passa a ter esse e-mail e o Astro não pede e-mail na conversa seguinte.
- [ ] **CA-12** — Dado um contato com e-mail, quando ele envia um formulário com outro e-mail, então o e-mail do contato não muda.
- [ ] **CA-13** — Dado um horário marcado pelo Astro, quando o cliente abre o link do agendamento, então o status é "Confirmado".

- [ ] **CA-14** — Dado Google conectado e agenda on-line, quando o Astro agenda, então o evento existe no Google Agenda, o cliente recebe o link do Meet na conversa e o lead com e-mail recebe o convite.
- [ ] **CA-15** — Dado lembrete em "30 min antes", quando o horário se aproxima, então o cliente recebe o lembrete por WhatsApp com o link da reunião.
- [ ] **CA-16** — Dado um agendamento com evento no Google, quando o cliente remarca pelo Astro, então o evento muda de horário; quando cancela, o evento some.
- [ ] **CA-17** — Dado uma empresa sem Google conectado, quando o Astro agenda, então o agendamento é criado e confirmado sem erro.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Lead sem `publicToken` | Link sai sem `leadToken`; o formulário abre e pede nome e telefone. |
| CB-2 | Formulário enviado duas vezes com a mesma tag | O fluxo dispara nas duas vezes; o limite de execuções por hora do fluxo protege contra excesso. |
| CB-3 | Resposta com várias tags, cada uma com um fluxo | Cada fluxo dispara uma vez. |
| CB-4 | Formulário sem funil e coluna configurados | Não há lead vinculado: nada dispara. |
| CB-5 | Lead novo criado pelo formulário | Além do "Novo Lead" de hoje, as tags das respostas disparam "Lead com Tag". |
| CB-6 | "menu" três vezes em 10 segundos | Três menus. Aceito: é pedido explícito; o limite de 60 respostas por hora continua valendo. |
| CB-7 | `voiceCallMaxMinutes` fora de 1–10 ou não numérico | Vale 10. |
| CB-8 | Chamada da equipe (número permitido) | Continua com 10 minutos; o campo é só do atendimento ao cliente. |
| CB-9 | E-mail inválido ou Resend sem chave | Envio falha em silêncio, com log; WhatsApp segue. |
| CB-10 | Número não oficial desconectado | Continua pulando a confirmação por WhatsApp, como hoje. |
| CB-11 | Janela de 24 h fechada | WhatsApp não sai (regra atual); o e-mail sai. |
| CB-12 | Lead sem e-mail e Google conectado | Evento criado sem convidado; o link do Meet vai só pela conversa. |
| CB-13 | Lembrete de 30 min fora da janela de 24 h em número oficial | Sai pelo template configurado, que não leva o link (variáveis fixas); o link já foi na confirmação e no convite. |
| CB-14 | Evento apagado direto no Google antes do cancelamento | O cancelamento segue; o vínculo é limpo (resposta 410). |
| CB-15 | Agendamento marcado antes desta entrega, sem evento no Google | Remarcar e cancelar seguem normais; nada é enviado ao Google. |

## 6. Decisões de design

### D-1 — Reaproveitar "Lead com Tag" em vez de criar o gatilho "Formulário respondido"

As opções do formulário já carregam `tagId` e a tag já é gravada no lead. Faltava só o disparo. Um tipo de gatilho novo exigiria valor novo no enum `NodeType` (migration), quadro novo no editor e executor nos dois motores. Descartado por custo; fica em "depois" se o reaproveitamento não bastar.

### D-2 — Variável de ambiente para o disparo pelo formulário

Empresas que já têm formulário com tag nas opções e fluxo "Lead com Tag" na mesma tag passariam a receber disparos que hoje não recebem. Para não mudar o comportamento delas sem aviso, o disparo nasce desligado (`FORM_ANSWER_TAGS_TRIGGER_FLOWS`, lida no servidor em tempo de execução). Descartado: opção por formulário, que pediria coluna nova em `FormSettings`.

### D-3 — Duração da chamada dentro de `capabilities`

`AiSettings.capabilities` é JSON e já guarda `voiceCall`. Campo novo com padrão 10 não pede migration e funis antigos seguem iguais.

### D-4 — Confirmação por WhatsApp decide pelo provedor, não pelo campo `status`

Para número oficial, quem diz se dá para enviar é a janela de 24 h (`isFreeFormWindowOpen`), que já é conferida logo abaixo. O campo `status` continua valendo para número não oficial.

### D-6 — Google Agenda como complemento do agendamento

A criação do evento saiu do botão "Sincronizar" para `src/features/agenda/lib/google-calendar-event.ts` e passou a ser chamada também pelo Astro. A conta usada é a de quem configurou o atendimento (login Google) ou, na falta, a integração Google da empresa (satélite Gmail). Falha no Google nunca desfaz o agendamento. O link do Meet não é guardado no banco (sem migration): vai na resposta da ferramenta, na confirmação e no texto do lembrete.

### D-7 — Lembrete de 30 minutos como meia hora em `hoursBefore`

`reminder.hoursBefore` passa a aceitar 0,5. Descartado: campo novo em minutos, que duplicaria a regra de cancelar e recriar o lembrete.

### D-5 — E-mail dentro da função `booking-notification`

É a função que já roda a cada agendamento criado ou cancelado pelo chat. Nenhuma função nova no Inngest, então não depende de "Resync" em produção.

## 7. Segurança

- O link do formulário passa a levar o `publicToken` do lead, que já é o identificador público usado em `/lead/<token>` e no prefill. Ele só devolve nome, e-mail e telefone do próprio lead.
- O disparo pelo formulário só alcança fluxos ligados do funil do lead, pelo mesmo helper do disparo humano (`findLeadTaggedMatchingWorkflows`).
- O e-mail vai apenas para o e-mail do próprio lead do agendamento e contém só os dados daquele agendamento.
- O evento do Google leva só título, horário, observação do próprio agendamento e o e-mail do próprio lead como convidado; o token do Google nunca sai do servidor.
- Envio público de formulário passa a poder iniciar fluxo: o limite de execuções por hora do fluxo e a exigência de fluxo ligado na tag limitam o abuso. Sem a variável, nada muda.

## 8. Regras da Meta

- Nada novo é enviado fora da janela de 24 h: o fluxo disparado pelo formulário usa o envio de sempre, que respeita a janela, e a confirmação de agendamento continua conferindo a janela antes de enviar.
- Reenvio do menu só acontece em resposta a mensagem do cliente.
- Chamada: reduzir a duração não muda o consentimento nem a forma de atender.

## 9. O que fica para depois

- Gatilho "Formulário respondido" com as respostas disponíveis no texto do fluxo.
- Corrigir o campo `status` da instância oficial.
- Guardar o link do Meet no agendamento e mostrá-lo na página pública (pediria coluna nova).
- Criar o evento no Google para agendamentos feitos pela página pública e pela tela da agenda.
- Item "Testar chamada com o Astro" no menu da ÓRBITA HUB (depende de RF-5 em produção e das chamadas habilitadas no servidor).

## 10. Riscos e rollback

- RF-2 é desligado pela variável. Os demais itens são reversíveis revertendo o commit; nenhum muda dados.
- RF-10 passa a enviar confirmações que hoje são puladas em número oficial. É o comportamento esperado, mas é mensagem nova para clientes de quem já usa agenda com número oficial.

## 11. Banco

Sem migration. `voiceCallMaxMinutes` vive no JSON `AiSettings.capabilities`.

## 12. Ordem de entrega

1. RF-1 (link), RF-4 (menu), RF-10 (confirmação em número oficial).
2. RF-5 a RF-8 (duração da chamada).
3. RF-9 (e-mail).
4. RF-2 e RF-3 (disparo pelo formulário).

## 13. Changelog da spec

- 2026-10-12 — criada a partir do teste real da ÓRBITA HUB.
- 2026-10-12 — segundo teste real: o Astro pediu o e-mail já informado no formulário e o link do agendamento mostrava "Pendente". Entraram RF-11, RF-12 e CA-11 a CA-13; a criação automática do evento no Google com Meet ficou em "depois".
- 2026-10-12 — terceiro lote, a pedido: Google Agenda com Meet ao agendar pelo Astro, lembrete de 30 minutos com o link e evento acompanhando remarcação e cancelamento (RF-13 a RF-16, CA-14 a CA-17, D-6, D-7).
- 2026-10-12 — implementação: o e-mail roda numa etapa própria do Inngest (`send-booking-email`) para não sair duas vezes se a função repetir; data e hora da confirmação (WhatsApp e e-mail) passam a ser formatadas no fuso de São Paulo, antes dependiam do fuso do servidor. Sem runner de teste no projeto (CLAUDE.md, regra 20): os critérios de aceite ficam para teste manual.
