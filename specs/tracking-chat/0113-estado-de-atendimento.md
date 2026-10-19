---
id: 0113
titulo: Estado de atendimento — o cliente nunca fica sem resposta, e a IA nunca trava os Gatilhos
dominio: tracking-chat
status: em-revisao
autor: Weydson (com Claude)
criada: 2026-10-19
atualizada: 2026-10-19
branch: feature/W-gatilhos-tags-do-chat-20261017
pr:
peso: completa
---

# 0113 — Estado de atendimento

Revisa a [0042](../leads/0042-org-padrao-tags-automaticas-e-link-de-app.md) (etiquetas automáticas) e depende da [0112](../workflows/0112-lembretes-que-param-quando-o-cliente-responde.md) (paridade dos Gatilhos).

## 1. Contexto

A chave da IA do lead (`Lead.isActive`) mistura três significados: "IA pode falar", "lead ativo" (relatórios, Rodízio) e uma trava de envio que derruba fluxos. Levantamento de 17/10/2026 (cerca de 95 pontos no código):

- `leads/update.ts:66` usa `active: z.boolean().optional().default(false)` e grava `isActive` em **toda** edição de lead: nome, etapa, funil, reabrir conversa. A IA desliga sem ninguém pedir.
- Toda mensagem manual do atendente chama `claimLeadForAttendant` (`message/utils.ts`) e desliga a IA para sempre.
- Com a IA desligada, `send-link-to-lead`, `send-buttons-to-lead` e `send-template-to-lead` recusam com "Lead is not active". Quebram passos de Formulário, Agenda, Proposta, Contrato, Linnker, N-Box, Route, aceite e formulário pela conversa, e lembretes de agendamento. Menus que disparam ramo de fluxo, "fluxo esperando resposta" e cupom de campanha ficam atrás da trava da IA (`agent.ts:188-220`).
- As etiquetas de atendimento estão invertidas e coexistem. "Em atendimento" entra em toda mensagem do cliente e nunca sai; "Aguard. atendimento" entra após 15 min sem resposta.
- A resposta humana pela plataforma não é registrada (`lastOutboundAt` não é gravado; na API oficial "Aguard." nunca sai), e a IA e as automações contam como "resposta".
- `createNotification` (`admin/lib/notification-service.ts:259-270`) envia o aviso interno por WhatsApp para o telefone **de um lead**.
- O gatilho "IA finalizou" só é disparado por uma rota que ninguém chama.

O caso real que motivou: um cliente da PLENOCAR (16/10) pediu o curso, recebeu as aulas grátis e ficou sem nenhum follow-up. Quando o atendente respondeu à mão, a IA desligou.

## 2. Objetivo

O cliente nunca fica sem resposta na ausência do humano. A IA fala curto e natural e só quando precisa. Mensagens fixas resolvem o que não precisa de IA. Nenhum estado da IA interrompe Gatilhos ou follow-ups. O estado do atendimento fica visível em duas etiquetas de tempo real que nunca coexistem.

### Não-objetivos

- Tela para editar os pontos do Score (vem depois; os pontos ficam fixos nesta versão).
- Reescrever a IA de atendimento (o prompt e as ferramentas continuam; muda quando ela age e o contexto que recebe).
- Migrar o histórico antigo de etiquetas.
- Criar tabela nova: tudo usa tabelas e campos que já existem.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | `leads.update` só grava `isActive` quando o campo vier no pedido; nenhuma edição de lead mexe na IA. |
| RF-2 | Nenhum passo de Gatilho, lembrete ou envio automático depende do estado da IA do lead. |
| RF-3 | Menus que disparam ramo de fluxo, "fluxo esperando resposta" e cupom de campanha rodam independente da IA. |
| RF-4 | Toda mensagem enviada por um atendente pelo chat grava `lastOutboundAt` e `Message.senderId` = atendente. |
| RF-5 | Aviso interno por WhatsApp vai só para o número do membro (perfil ou número liberado do Astro), nunca para um lead. |
| RF-6 | O estado de atendimento é o `Lead.statusFlow`: `WAITING` = "Aguard. atendimento", `ACTIVE` = "Em atendimento", `FINISHED` = "Finalizado". As etiquetas espelham o campo e nunca coexistem. Toda troca passa por um único ponto (`setStatusFlow`). |
| RF-7 | Cada funil escolhe quem responde primeiro: `EQUIPE` ou `IA` (padrão `IA` em funil com IA conectada, como hoje). Tempos e textos ficam nas configurações de IA do funil. |
| RF-8 | Funil `EQUIPE`: mensagem do cliente sem resposta em 3 min recebe uma **mensagem fixa sem IA** por espera. +5 min sem resposta: a IA responde lendo o resumo. Reclamação do cliente durante a espera faz a IA responder na hora. |
| RF-9 | "Em atendimento" começa na **troca de verdade**: dentro da seção aberta, o cliente escreveu e um humano ou a IA falou com ele. Mensagem fixa, de fluxo, de campanha e de inatividade não conta. O estado sai sempre da seção aberta, nunca do `statusFlow` anterior: seção nova começa em "Aguard.". |
| RF-10 | Em atendimento, mensagem do cliente sem resposta humana em 10 min faz a IA continuar a conversa; o estado não muda. |
| RF-11 | Quando o cliente pede humano ou a IA transfere: o lead vai para `WAITING`, recebe a mensagem de espera e, se nenhum humano responder em 10 min, a IA volta. O gatilho "IA finalizou" é disparado. |
| RF-12 | Quando a IA entra por falta de humano, o dono ou um número autorizado é avisado. Avisos a cada 10 min, no máximo 3; depois, um sino/push final. |
| RF-13 | Seções de atendimento: cada oportunidade é uma seção (`LeadJourneyEvent` `attendance_section`) que abre e fecha por regra, sem IA, e guarda o resumo da conversa só daquele período. |
| RF-14 | O resumo da seção é atualizado na mesma chamada em que a IA responde, de forma incremental e com teto. Seções conduzidas só por humanos ganham um resumo final apenas se houve agendamento, proposta ou venda. |
| RF-15 | O contexto da IA passa a ser: resumo da seção + últimas ~10 mensagens + uma linha de cada uma das 3 seções anteriores. |
| RF-16 | Score de atendimento da empresa e por atendente, lançado como `LeadJourneyEvent` `attendance_score` (tabela de pontos da seção 6). |
| RF-17 | "Agendado" entra em todo agendamento e sai ao cancelar ou passar a data, com histórico. Cancelamento, reagendamento e exclusão viram eventos da Jornada. |
| RF-18 | No horário de um agendamento, um cartão **interno** no chat pergunta à equipe Sim / Não / Cancelou. Sim finaliza; Não pergunta de novo em 10 min até 3 vezes e depois avisa o dono; Cancelou aplica "Cancelou" e dispara a recuperação. Cancelamento feito pelo cliente (link, chat do site, IA) também aplica "Cancelou"; cancelamento da equipe não. |
| RF-19 | Recuperação nativa: fluxo-modelo nos Gatilhos, disparado por "Cancelou". A IA escreve a partir do resumo e envia antes de a janela de 24 h fechar; fora dela, por modelo aprovado. |
| RF-20 | Mensagem enviada por passo de fluxo guarda `workflowId` e `nodeId`; no chat, "Editar gatilho" abre o passo exato no editor. |
| RF-21 | Variável `{{primeiro_nome}}` nas mensagens; textos nativos curtos e com o nome do lead. |
| RF-22 | Sai o botão "Ativar/Desativar IA" do chat e do card do kanban; no lugar, um selo com o estado. |
| RF-23 | O modelo novo é ligado por empresa (`ATTENDANCE_STATE_ORGS`); RF-1 a RF-5 valem para todas, sem interruptor. Só conversas de WhatsApp entram no modelo; Instagram e Facebook seguem com o botão da IA. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhum cron nem função periódica. Cada espera é **um** evento Inngest atrasado por lead (`sleepUntil`), cancelado quando a empresa responde. |
| RNF-2 | Nenhuma chamada de IA extra quando a IA já vai responder (o resumo vem na mesma chamada). Resumo com teto de 30 mensagens / 4 mil caracteres de entrada, ~120 palavras de saída e no máximo 6 atualizações por seção. |
| RNF-3 | Sem tabela nova e sem migration. |
| RNF-4 | Atualização do metadata da seção sem corrida: SQL único (`jsonb_set`) e função Inngest com concorrência 1 por lead. |

## 4. Critérios de aceite

Roteiro: simulação do Weydson (atendimento de peça, 19–20/10), com funil em `EQUIPE`.

- [ ] **CA-1** — Editar nome, etapa ou funil de um lead não muda `isActive` nem o estado de atendimento.
- [ ] **CA-2** — Fluxo com Formulário/Proposta/aceite roda com o lead em qualquer estado e com a IA sem falar.
- [ ] **CA-3** — Cliente manda "Oi" às 08:00 → "Aguard."; às 08:03 recebe a mensagem fixa (sem IA, sem Stars de IA).
- [ ] **CA-4** — Cliente reclama às 08:09 → a IA responde na hora, curto e com o nome; Score −10; resumo da seção atualizado.
- [ ] **CA-5** — Atendente responde às 08:12 e o cliente às 08:13 → "Em atendimento"; Score +5.
- [ ] **CA-6** — Cliente escreve às 08:13 e nenhum humano responde até 08:23 → a IA continua a conversa; segue "Em atendimento".
- [ ] **CA-7** — Cliente pede para separar às 10:00 → agendamento criado e "Agendado" com evento na Jornada.
- [ ] **CA-8** — No horário, o cartão interno aparece só para a equipe e nada é enviado ao cliente. Sim → "Finalizado", sai "Agendado", agendamento `DONE`, +5.
- [ ] **CA-9** — Não → nova pergunta em 10 min; após 3 "Não", o dono é avisado.
- [ ] **CA-10** — Cancelou → "Cancelou", −10, a recuperação envia antes de fechar a janela de 24 h.
- [ ] **CA-11** — IA transfere para humano e ninguém responde em 10 min → a IA volta e o dono recebe o aviso nº 1; aos 20 e 30 min, nº 2 e nº 3; depois, nenhum WhatsApp a mais.
- [ ] **CA-12** — "Aguard." e "Em atendimento" nunca aparecem juntas.
- [ ] **CA-13** — Funil `IA` (caso João Gabriel): a IA responde na hora e os follow-ups seguem com o lead em qualquer estado.
- [ ] **CA-14** — "Editar gatilho" numa mensagem de fluxo abre o passo exato no editor.
- [ ] **CA-15** — Aviso interno com WhatsApp ligado chega no número do membro e nunca no de um lead.
- [ ] **CA-16** — Empresa fora do interruptor continua com o comportamento atual, exceto RF-1 a RF-5 e os relatórios que deixaram de usar `isActive` como "lead ativo" (funil, resgate, `list-dashboard`, contatos do Financeiro, analytics e interesse do Astro, alertas "lead esperando"/"parado", busca do `/pesquisar`): esses números mudam para todas, porque o filtro antigo escondia leads com a IA pausada.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Cliente manda 3 mensagens seguidas | Um único evento de espera (o último reagenda); uma única mensagem fixa. |
| CB-2 | Atendente responde 1 s antes do evento disparar | O evento confere a última mensagem da empresa e não age. |
| CB-3 | Empresa sem as etiquetas de sistema (antiga) ou com elas arquivadas | O estado (`statusFlow`) segue valendo; etiquetas criadas sob demanda; arquivada não aparece. |
| CB-4 | Lead `FINISHED` volta a escrever | Reabre como `WAITING` e abre seção nova. |
| CB-5 | Sem saldo de Stars | A mensagem fixa sai (sem IA); o aviso de "sem saldo" sai uma vez por espera. |
| CB-6 | Limite de 60 respostas/hora da IA | A IA não volta na retomada; o dono é avisado. |
| CB-7 | Janela de 24 h fechada (API oficial) | Nada de texto livre ao cliente; a recuperação usa modelo aprovado; os avisos ao dono usam o modelo da empresa ou só sino/push. |
| CB-8 | Mensagem interna (cartão) | Nunca sai pelo provedor; fora de "sem resposta", do contexto da IA e do resumo. |
| CB-9 | Duas atualizações da mesma seção ao mesmo tempo | SQL único por campo e concorrência 1 por lead: nenhuma se perde. |
| CB-10 | Agendamento remarcado | "Agendado" segue; os eventos de "passou a data" e do cartão usam a data nova (o antigo vê a data mudada e não age). |
| CB-11 | Atendente responde pelo celular (eco Uazapi) | Conta como resposta humana (pipeline `fromMe`). |

## 6. Decisões de design

### D-1 — O estado é o `statusFlow`, não um campo novo
O campo já move as abas do chat, o Rodízio e o Insights. Usá-lo mantém uma fonte só. Consequência: o Rodízio passa a ler a fila como `WAITING` **sem responsável** e a capacidade como leads não `FINISHED`.

### D-2 — Tabelas existentes
Seções, Score e conferência do agendamento em `LeadJourneyEvent` (`kind` é texto livre, `metadata` Json); configuração em `AiSettings.capabilities`. Descartado: tabelas `AttendanceSection` / `AttendanceScoreEvent` (pedido do Weydson, 19/10) e cartão interno como `Message` (ver changelog: entraria na janela da Meta, na aba "sem resposta", no histórico da IA e nos relatórios de mensagens).

### D-3 — Um evento por lead, nunca relógio
Cada mensagem do cliente agenda **um** `attendance/check` com `sleepUntil`. Descartado: cron de varredura (custo constante mesmo sem conversa).

### D-4 — Resumo na mesma chamada da IA
Descartado: resumir a cada mensagem ou o histórico inteiro (custo cresce com a conversa).

### D-5 — Pontos do Score

| Evento | Pontos |
| --- | --- |
| Resposta (humana ou fixa) dentro do tempo da etapa | +2 |
| Cliente sem nenhuma resposta além do tempo | −5 |
| Cliente reclama da demora | −10 |
| Humano responde um cliente que esperava | +5 |
| Compromisso cumprido ("Sim" no cartão) | +5 |
| Não compareceu ("Cancelou" no cartão) | −10 |
| Venda fechada (lead ganho ou pagamento recebido) | +10 |

## 7. Segurança de dados

- Aviso interno por WhatsApp só para número de membro da empresa dona do funil (RF-5). A busca pelo telefone de um lead é removida.
- Mensagem com `metadata.internal` nunca é enviada ao provedor nem entra no contexto da IA que fala com o cliente.
- Seções, resumos e Score ficam no escopo da empresa (lead → funil → empresa); o Insights filtra por organização.
- O resumo não guarda documento, cartão nem senha: a instrução do resumo manda omitir dados sensíveis.

## 8. Regras da Meta (conferidas em 19/10/2026)

- Texto livre ao cliente só dentro de 24 h da última mensagem dele; fora disso, modelo aprovado (categoria Marketing para recuperação).
- A plataforma não manda mensagem proativa repetida ao cliente: uma mensagem fixa por espera, a IA só responde ao que o cliente escreve, e a recuperação é uma por cancelamento.
- Avisos internos vão para números da própria equipe, com limite (3), para não pesar na qualidade do número.
- O botão "Parar mensagens" e "SAIR" seguem valendo para os fluxos de recuperação.

## 9. Riscos e rollback

- **Mudança visível nos números:** relatórios que filtravam por `isActive` passam a contar leads que a pausa e o bug escondiam; os cartões "Aguardando"/"Em atendimento" mostram o estado ao vivo. Conferir na PLENOCAR antes de ligar para todas.
- **Abas do chat:** "Em atendimento" passa a mostrar só conversas com troca de verdade; "Sem resposta" passa a ler `WAITING`.
- **Rodízio:** com o interruptor, a fila e a carga do consultor contam só conversas vivas (cliente escreveu nas últimas 24 h, estado "Aguard." ou "Em atendimento", sem estar arquivado). Sem isso, todo lead antigo, que nasce `ACTIVE` por padrão, lotava os consultores no primeiro dia.
- **Automação de inatividade:** desligada nas empresas do interruptor; mensagem fixa, IA e avisos passam a ser do estado de atendimento. Ligar o interruptor sem avisar quem configurou a inatividade confunde.
- **Empresa abrindo conversa** (campanha, "iniciar conversa") não muda o estado: marcar "Aguard." levaria a campanha inteira para a fila do Rodízio e para os fluxos dessa etiqueta.
- **Antes de ligar numa empresa:** conferir as abas e os números do Insights; leads antigos seguem `ACTIVE` até o cliente escrever de novo. Depois do deploy, "Resync" do Inngest.
- **Rollback:** desligar `ATTENDANCE_STATE_ORGS`. RF-1 a RF-5 são correções e ficam. Sem migration.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-19 | Weydson (com Claude) | Criada a partir do plano aprovado |
| 2026-10-19 | Claude | Implementação diverge do plano em três pontos: reclamação detectada por regras de texto (sem chamada de IA); resumo pedido num bloco `<notas>` da própria resposta, separado antes do envio; mensagem de "consultor" sai quando o cliente escreve na espera, não na hora da transferência. |
| 2026-10-19 | Claude | Revisão da fase 1 (dois revisores): troca de verdade passa a vir só da seção (`lastHumanAt`/`lastAiReplyAt`); espera de transferência tem prioridade sobre "Em atendimento"; seção nova começa em "Aguard."; checagens com trava na seção (`patchSectionIf`), id de evento e passos separados; seção aberta com trava por lead; só WhatsApp; eco do que a plataforma enviou não conta como atendente; reabertura de conversa finalizada fica com o atendimento; limite de respostas não traz a IA de volta; avisos ao dono sem WhatsApp em dobro e respeitando a preferência; campanha de sorteio passa com a IA pausada; empresa abrindo conversa não muda o estado; Rodízio conta só conversas vivas; automação de inatividade desligada no interruptor; etiquetas do atendimento só do tipo `SYSTEM` e criadas sob demanda; Score só aparece com o interruptor; histórico da IA cai para 10 mensagens quando há resumo; eventos da seção, do Score e da conferência fora da página pública do lead. |
| 2026-10-19 | Claude | Fase 2: conferência do agendamento é evento `appointment_check` da Jornada lido pelo chat (cartão acima da conversa), não `Message`. "Esperar" ganha o modo "antes de fechar a janela de 24 h". Modelo "Recuperar quem cancelou" instalado (desligado) em funil novo e disponível ao Astro. Texto da IA nos fluxos recebe o último resumo do atendimento (`vars.resumoAtendimento`). Pendente: resumo final de seção conduzida só por humanos (RF-14, segunda parte). |
| 2026-10-19 | Claude | Revisão `/code-review` (xhigh): entrada da IA por reclamação com id de evento próprio (era descartada pelo do `holding`); remarcar encerra a conferência antiga e responder cartão de horário mudado não mexe no agendamento; Rodízio conta lead novo sem mensagem e usa uma regra só de carga (lista, distribuição e finalizar); interruptor por empresa **e** canal WhatsApp em todos os pontos; +5/+2 só para quem atende cliente em "Aguard."; campos de minutos limitados ao sair do campo; espera do agendamento em trechos de até 6 dias; resposta pronta do robô (menu, campanha, loja) marca a seção; falha no envio da mensagem fixa não repete a cobrança; etiqueta do atendimento reaproveita a da empresa com o mesmo slug (sem duplicar nome); modelo de recuperação só nas empresas do interruptor, com "Cancelou" resolvida; âncoras e guia do Astro para a configuração de atendimento e o cartão. |
| 2026-10-19 | Claude | Fase 3: mensagem de passo de fluxo guarda `metadata.flowOrigin = { workflowId, nodeId }` nos dois motores (o contexto do fluxo leva `workflowId`; os envios de texto, mídia, botões, modelo, link de app e passos de conversa repassam a origem). No chat, "Editar gatilho" abre `/tracking/{id}/workflows/{workflowId}?node={nodeId}`: o editor centraliza o passo e abre a configuração dele (átomo `nodeToOpenAtom` lido pelo `BaseExecutionNode`). Mensagem fixa do atendimento mostra "Editar mensagem" e abre a configuração do funil. Tom curto e com o primeiro nome em toda resposta da IA no interruptor. Pendente: reescrever os 6 lembretes livres da PLENOCAR (dado de produção, precisa de autorização). |
