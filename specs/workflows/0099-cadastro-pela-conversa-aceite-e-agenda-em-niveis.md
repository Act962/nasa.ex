---
id: 0099
titulo: Cadastro pela conversa, aceite da LGPD e agenda por especialidade, unidade e profissional
dominio: workflows
status: aprovada
autor: Weydson
criada: 2026-10-12
atualizada: 2026-10-12
branch: feature/workflows-simulador-visual-20261010
pr:
peso: completa
---

# 0099 — Cadastro pela conversa, aceite da LGPD e agenda em níveis

## 1. Contexto

Em 12/10/2026 o Weydson percorreu o atendimento que a Clínica Tércio Rezende usa hoje no WhatsApp, de outro fornecedor, e pediu a comparação com a plataforma. A conversa foi lida inteira e as seis listas foram abertas uma a uma.

O atendimento deles faz, nesta ordem: boas-vindas, aceite da LGPD, "já é paciente?", pesquisa de origem, menu de nove assuntos, pedido do CPF com validação, busca do paciente, cadastro (nome, gênero, nascimento, convênio), resumo para confirmar, especialidade, unidade, profissional, data, resumo com protocolo e confirmação.

A plataforma já tem botões, listas, pesquisa com tag por opção, menu de assuntos, agendamento por botões, alteração, cancelamento e transferência para atendente. Três peças não existem:

1. Perguntar algo, esperar o cliente digitar, validar e guardar.
2. Registrar que o cliente aceitou os termos antes de seguir.
3. Agenda organizada por especialidade, unidade e profissional, com a ficha de cada profissional.

O que já existe e será reaproveitado:

- **Formulários e fichas** (`features/form`, `features/form-records`): o formulário já define campos (texto, número, data, opção única, sim/não), a resposta fica em `FormResponses` e a ficha em `FormRecord`, ligada ao lead. As validações de CPF, telefone, CEP e e-mail estão em `form/lib/masks.ts`.
- **Lead**: já tem `name`, `email`, `phone`, `document` e endereço.
- **Pausa do fluxo**: o motor já suspende e retoma (`WAIT_FOR_EVENT`, e a saída por botão da spec 0090, seção F).
- **Jornada do lead** (`LeadJourneyEvent`) e tags: já registram fatos com data.
- **Agenda** (`Agenda`): já tem nome, descrição, responsáveis, disponibilidade e o agendamento por botões (spec 0089).
- **Menus salvos** (`AiButtonPreset.buttons`, em JSON): aceitam campo novo por opção sem migration.

## 2. Objetivo

Um fluxo consegue cadastrar o cliente pela própria conversa, registrar o aceite dos termos e levar o cliente até o profissional certo antes de marcar, sem IA e sem sair do WhatsApp.

### Não-objetivos

- **WhatsApp Flows** (formulário em telas dentro do WhatsApp): fica para uma spec própria. O cadastro desta spec funciona em qualquer número.
- Buscar o paciente no sistema de terceiros da clínica.
- Atendimento "por ordem de chegada", sem hora marcada.
- Número de protocolo.
- Trocar o agendamento por botões que já existe: ele ganha os níveis, não é refeito.

## 3. Requisitos

### A. Passo "Preencher formulário pela conversa"

- **RF-1** Passo novo nos fluxos em modo agente. Na configuração, a pessoa escolhe um formulário da empresa e quais campos dele serão perguntados, na ordem.
- **RF-2** Para cada campo, o passo envia a pergunta e espera a resposta. Campo de opção única ou sim/não vira botões (até 3 opções) ou lista (até 10). Os demais esperam texto digitado.
- **RF-3** A resposta é validada pelo tipo do campo: CPF, data (dd/mm/aaaa), telefone, e-mail, CEP, número. Resposta inválida recebe uma mensagem curta dizendo o formato e a pergunta de novo, até 3 tentativas.
- **RF-4** Campo de opção com lista longa (ex.: convênio): o cliente digita, o passo procura na lista de opções do formulário sem diferenciar maiúsculas e acentos. Não achou: oferece "Digitar novamente", uma opção padrão configurável (ex.: "Particular") e "Falar com atendente".
- **RF-5** No fim, o passo mostra o resumo e pede confirmação ("Está correto?" Sim / Corrigir). "Corrigir" pergunta qual campo e refaz só ele.
- **RF-6** Confirmado, grava a resposta do formulário e a ficha ligadas ao lead, pelo mesmo caminho do envio de formulário. Campos mapeados para o lead (nome, e-mail, telefone, CPF) atualizam o lead.
- **RF-7** Campo que o lead já tem preenchido pode ser pulado ("Perguntar só o que falta", ligado por padrão).
- **RF-8** Saídas do passo: "Concluído", "Desistiu" (não respondeu no prazo ou esgotou as tentativas) e "Pediu atendente".
- **RF-9** Enquanto o passo espera uma resposta, a mensagem do cliente vai para ele, e não para a assistente. "Falar com atendente", "menu" e "cancelar" interrompem o passo.
- **RF-10** Prazo de espera por resposta configurável, com padrão de 30 minutos. Vencido, sai por "Desistiu" e nada é gravado.

### B. Aceite dos termos

- **RF-11** Passo novo "Pedir aceite". Configuração: texto dos termos, link da política de privacidade e os rótulos dos dois botões.
- **RF-12** Saídas: "Aceitou" e "Recusou". Sem resposta no prazo sai por "Recusou".
- **RF-13** Ao aceitar, registra na jornada do lead a data, o texto e o link apresentados, e aplica a tag do sistema "Aceitou os termos". Recusa também é registrada.
- **RF-14** "Só pedir uma vez" (ligado por padrão): lead que já aceitou a mesma versão do texto segue direto por "Aceitou".

### C. Agenda em níveis

- **RF-15** A agenda ganha três campos opcionais: especialidade, unidade e ficha do profissional (texto livre com o que atende, valores e avisos).
- **RF-16** No agendamento por botões, quando as agendas do funil têm especialidade ou unidade preenchidas, o cliente escolhe primeiro a especialidade, depois a unidade e depois a agenda. Nível com uma opção só é pulado.
- **RF-17** Depois de escolher a agenda, se ela tem ficha do profissional, a ficha é enviada antes dos dias.
- **RF-18** Funil cujas agendas não têm esses campos preenchidos funciona exatamente como hoje.
- **RF-19** A lista de cada nível traz "Voltar" (um nível acima) e "Menu".

### D. Menus

- **RF-20** Cada opção de um menu salvo aceita uma descrição curta (até 72 caracteres), mostrada na lista do WhatsApp sob o título.

### E. Guia

- **RF-21** Âncora e guia do Astro para os dois passos novos e para os campos novos da agenda (regra 21).

## 4. Critérios de aceite

- **CA-1** Fluxo com o passo de formulário de 4 campos: o cliente responde os quatro, confirma, e a ficha aparece no lead com os quatro valores.
- **CA-2** CPF inválido: o passo responde com o formato esperado e pergunta de novo; nada é gravado.
- **CA-3** Três respostas inválidas seguidas: sai por "Desistiu" e nada é gravado.
- **CA-4** Convênio digitado que não está na lista: aparecem as três opções da RF-4; "Particular" grava a opção padrão.
- **CA-5** "Corrigir" no resumo refaz só o campo escolhido e volta ao resumo.
- **CA-6** Lead que já tem nome e telefone: com "Perguntar só o que falta", esses dois não são perguntados.
- **CA-7** Enquanto o passo espera, a mensagem do cliente não gera resposta da assistente nem chamada de IA.
- **CA-8** "Falar com atendente" no meio do cadastro: sai por "Pediu atendente" e nada é gravado.
- **CA-9** Aceite: o lead ganha o registro na jornada com data, texto e link, e a tag. Segunda passagem pelo passo, com o mesmo texto, segue direto.
- **CA-10** Recusa: o fluxo segue por "Recusou" e o cadastro não é pedido.
- **CA-11** Três agendas com especialidade e unidade: o cliente vê especialidade, unidade e agenda, nessa ordem; com uma unidade só, esse nível não aparece.
- **CA-12** Agenda com ficha: a ficha chega antes da lista de dias.
- **CA-13** Funil da Clínica de desenvolvimento, sem os campos preenchidos: o agendamento por botões responde como antes.
- **CA-14** Formulário de outra empresa informado no passo: recusado ao salvar o fluxo e ao rodar.
- **CA-15** Opção de menu com descrição: a descrição aparece na lista enviada.

## 5. Casos de borda

- **CB-1** O cliente manda áudio, imagem ou figurinha no lugar da resposta: conta como resposta inválida, com a mensagem "Escreva a resposta, por favor".
- **CB-2** O cliente responde duas mensagens seguidas: vale a primeira para o campo atual; a segunda é tratada como resposta do campo seguinte.
- **CB-3** O formulário é alterado enquanto um cliente está no meio do cadastro: o passo usa os campos que estavam configurados quando começou.
- **CB-4** Campo removido do formulário depois de configurado no passo: o passo fica em vermelho no editor ("Campo não existe mais no formulário") e o fluxo não liga.
- **CB-5** Número não oficial: botões e listas saem como texto numerado (spec 0095) e a resposta com o número vale.
- **CB-6** O cliente abandona e volta no dia seguinte: o cadastro recomeça do primeiro campo que falta.
- **CB-7** Dois fluxos esperando resposta do mesmo lead: vale o que começou por último; o anterior sai por "Desistiu".
- **CB-8** Data de nascimento no futuro ou CPF com dígitos repetidos: inválidos.
- **CB-9** Resposta maior que 500 caracteres: cortada em 500.

## 6. Decisões de design

### D-1 — O cadastro é um formulário, não uma lista de campos nova

A plataforma já tem formulários com tipos de campo, validação, respostas e fichas ligadas ao lead. Criar "campos do cadastro" à parte duplicaria tudo isso. O passo novo só muda o meio: em vez de o cliente abrir um link, as perguntas chegam pela conversa. A ficha gerada é a mesma que o resto da plataforma já lista, filtra e exporta.

### D-2 — Um passo que pergunta todos os campos, não um passo por campo

Um passo por campo deixaria o fluxo da Clínica com mais de dez quadros só para o cadastro, e a validação e o "corrigir" teriam de ser desenhados à mão. Um passo só resolve repetição, validação e resumo de forma igual para todos.

### D-3 — Perguntas pela conversa antes do WhatsApp Flows

O Flows pede tudo numa tela e gasta menos mensagens, mas só existe em número oficial e exige publicar e manter o formulário na conta da Meta de cada empresa. O passo pela conversa funciona em qualquer número e não depende de aprovação. O Flows entra depois, como outra forma de preencher o mesmo formulário.

### D-4 — O aceite fica na jornada do lead, sem tabela nova

O que precisa ficar guardado é: quem, quando e o que foi apresentado. A jornada do lead já guarda fatos com data e dados, e a tag permite filtrar. Uma tabela de consentimentos só se justificaria com revogação e versões por finalidade, que não foram pedidas.

### D-5 — Especialidade e unidade como campos da agenda

Cada agenda continua sendo o que é hoje (em geral, um profissional num local). Dois campos de texto bastam para agrupar, e a ficha do profissional é um terceiro. Tabelas de especialidade e de unidade dariam cadastro e telas novas para um agrupamento que cabe em dois rótulos.

### D-6 — Quem espera a resposta é o fluxo

Hoje, toda mensagem digitada vai para a assistente. Durante o cadastro isso faria a IA responder "03261801336". A ordem de quem atende passa a ser: fluxo esperando resposta, menu de botões, menu de perguntas, menu do roteiro, assistente.

## 7. Segurança

- **Dado pessoal**: CPF, nascimento e convênio são dados pessoais, e o convênio aproxima de dado de saúde. Ficam só na ficha e no lead, com as permissões que fichas e leads já têm. Não entram em log, no texto de erro, no nome de arquivo nem em evento do Inngest além do identificador da resposta.
- **Resumo na conversa**: o resumo mostra os dados ao próprio cliente que os digitou, na conversa dele. O CPF aparece inteiro só nesse resumo; em telas de lista da plataforma continua valendo a regra de exibição de cada tela.
- **Empresa certa**: formulário, agenda e lead são conferidos contra a empresa do fluxo ao salvar e ao rodar. Formulário de outra empresa é recusado.
- **Entrada de fora**: tudo que o cliente digita é tratado como texto, nunca como instrução, e não é enviado a modelo de IA neste passo. Tamanho limitado.
- **Aceite**: o registro guarda o texto e o link apresentados, para provar o que foi aceito. Recusa não bloqueia a pessoa de falar com atendente.
- **Quem configura**: os passos novos seguem a permissão de editar Automações.
- **Contra abuso**: limite de tentativas por campo e o limite de execuções por hora que cada fluxo já tem.

## 8. Regras da Meta

- Cada pergunta é uma mensagem dentro da janela de 24 horas, aberta pela mensagem do cliente: não é cobrada e não exige template.
- O cadastro gera mais mensagens que um formulário em tela. Para reduzir: perguntar só o que falta (RF-7) e não repetir pergunta além de 3 vezes.
- Botões e listas respeitam os limites da API oficial (3 botões, 10 linhas, título de 20 ou 24 caracteres, descrição de 72).
- Pedir dado de saúde pelo WhatsApp é permitido para a própria prestação do serviço, com o aceite antes. O passo de aceite existe para isso e deve vir antes do cadastro no modelo de fluxo.
- Prazo de espera longo pode vencer a janela: depois de 24 horas sem mensagem do cliente, o passo sai por "Desistiu" em vez de mandar mensagem fora da janela.

## 9. O que fica para depois

- WhatsApp Flows como segunda forma de preencher o formulário.
- Buscar o cliente em sistema externo antes de cadastrar.
- "Ordem de chegada" (data com turno, sem hora).
- Protocolo do agendamento.
- Submenu pronto em menus salvos e opção "voltar um passo" fora do agendamento.
- Modelo de fluxo "clínica" completo, montado com estas peças.

## 10. Riscos e rollback

- **Risco**: a mudança na ordem de quem atende (D-6) fazer a assistente ficar muda quando não devia. Mitigação: só vale enquanto existe um passo esperando resposta daquele lead, com prazo; sem passo esperando, nada muda.
- **Risco**: migration na agenda. São três colunas opcionais, sem valor padrão obrigatório; funis sem os campos seguem iguais (RF-18).
- **Risco**: o cadastro ficar longo e o cliente desistir. Mitigação: RF-7 e o prazo.
- **Rollback**: os dois passos novos ficam atrás de uma opção de liberação (`NEXT_PUBLIC_WORKFLOW_FORM_CHAT`); desligada, os passos somem do editor e não rodam. Os níveis da agenda só aparecem se os campos forem preenchidos.

## 11. Banco

Uma migration aditiva, que só roda com autorização explícita:

- `Agenda.specialty` (texto, opcional), `Agenda.unit` (texto, opcional), `Agenda.professionalNotes` (texto, opcional).

Sem tabela nova. A espera pela resposta fica no estado da execução do fluxo, que já é gravado; o aceite, na jornada do lead; a descrição das opções, no JSON do menu salvo.

## 12. Ordem de entrega

1. Aceite dos termos (menor, e é pré-requisito do cadastro).
2. Passo de formulário pela conversa.
3. Agenda em níveis e descrição nas opções de menu.
4. Fluxo da Clínica montado com as três peças e testado no WhatsApp real, do "Oi" até o resumo, sem confirmar agendamento.

## 13. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-12 | Weydson | Rascunho, depois da leitura do atendimento atual da Clínica Tércio Rezende no WhatsApp (conversa inteira e as seis listas abertas) e do "aprovado, pode escrever a spec das peças que faltam". |
| 2026-10-12 | Weydson | **Aprovada, implementada e testada no WhatsApp real** ("aprovado, pode implementar e rodar a migration"). **Peças**: regras em `workflows/lib/conversation-steps.ts` e `workflows/lib/form-chat.ts` (puras); servidor em `workflows/lib/agent-executors/conversation-steps.ts`; os dois passos são variações do quadro Enviar Mensagem (`payload.type` `CONSENT` e `FORM_CHAT`), sem tipo novo de quadro e sem mexer no enum do banco; janelas em `tracking-executions/components/conversation-steps/`; o motor volta ao mesmo passo depois da resposta (`resumeSameNode` em `run-workflow.ts`); `tracking-chat-ai/lib/flow-awaiting-reply.ts` deixa com o fluxo a mensagem que responde a um passo (D-6); níveis em `guided-menu.ts` e `menu-ids.ts`; migration `20261012120000_agenda_levels` aplicada no banco de desenvolvimento. **Divergências do rascunho**: (1) **As respostas do cliente ficam no rascunho da resposta do formulário**, e não no estado da execução: assim CPF e nascimento não vão para o registro de execuções dos fluxos. Efeito: o passo usa o formulário como está na hora de cada pergunta (CB-3 não vale como escrito; campo removido é ignorado). (2) **Campos que dá para perguntar**: texto, campo com validação (CPF, telefone, CEP, e-mail), opção única, lista suspensa, lista do próprio campo, data sem hora, nota e régua. Ficam de fora: múltipla escolha, arquivo, assinatura, lista de itens, cálculo. (3) **Convênio** é um campo de lista do formulário (lista do próprio campo ou lista suspensa com mais de 10 opções). (4) **CB-8** vale para CPF; "nascimento no futuro" não é barrado, porque o passo não sabe que uma data é de nascimento. (5) **CB-4** (campo removido deixa o passo em vermelho) não foi feito: o campo é ignorado ao rodar. (6) **RF-20** (descrição em cada opção de menu salvo) **não foi implementado nesta entrega**. (7) **Telefone do lead não é sobrescrito** pelo cadastro: é o número da própria conversa. (8) **Só fluxo em modo agente**; no motor antigo o passo falha com mensagem clara. (9) **Achado no teste**: mensagem enviada por fluxo não contava como resposta ao cliente, e quem conversava com um fluxo ganhava "Aguard. atendimento". `sendLinkToLead` e `sendButtonsToLead` passam a atualizar `lastOutboundAt`. Muda o comportamento de todos os fluxos: menos leads marcados como sem resposta. **Verificado**: `scripts/verify-conversation-steps.ts` (regras, 30 verificações), `scripts/verify-agenda-levels.ts` (níveis, 6 de 6, sem enviar). **Teste real em 12/10** (`scripts/setup-clinic-registration-flow.ts`, número oficial de desenvolvimento): aceite por botão; CPF inválido recusado e pedido de novo; CPF válido; nome; gênero por botão; data; convênio fora da lista com as três opções e "Particular"; resumo; "Corrigir" trocando só o convênio; confirmação e "Cadastro concluído". No banco: resposta concluída, ficha finalizada, nome e CPF no lead, aceite na jornada, tag "Aceitou os termos" e **nenhuma chamada de IA**. Níveis no WhatsApp: especialidade, depois unidade, depois os dias. **Pendência do teste**: a ficha do profissional saiu no ensaio e ao rodar o mesmo caminho por script com envio real, mas não nos toques feitos com o servidor de desenvolvimento no ar desde antes da correção; indica código antigo em memória no servidor (precisa reiniciar para confirmar). **Não testado**: recusa do aceite, desistência por prazo, "falar com atendente" no meio, número não oficial e as janelas de configuração na tela. |
