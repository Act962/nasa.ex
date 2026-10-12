---
id: 0098
titulo: Uma saída por opção no menu salvo enviado pelo fluxo
dominio: workflows
status: rascunho
autor: Weydson
criada: 2026-10-11
atualizada: 2026-10-11
branch: feature/workflows-simulador-visual-20261010
pr:
peso: completa
---

# 0098 — Uma saída por opção no menu salvo enviado pelo fluxo

## 1. Contexto

O fluxo de cada assunto envia um menu salvo de perguntas ("Perguntas: SPA dos Olhos", spec 0096). O cliente toca numa pergunta e o código responde com o texto guardado no menu, sem IA. No editor esse quadro tem uma saída só, e nada pode ser ligado a uma pergunta específica.

O Weydson desenhou um ponto de saída ao lado de cada opção e perguntou: "É possível inserir um nó em cada resposta?". Ele aprovou o caminho 1: saída por opção também no menu salvo, sem mudar o que já funciona.

O que já existe e será reaproveitado:

- **Saída por botão** (spec 0090, seção F): `buttonReplyOutputs` e `buttonOutputId` (`workflows/lib/button-reply-flow.ts`) desenham uma saída por botão no quadro "Enviar Mensagem", mas só para botões escritos no próprio quadro. O menu salvo ficou de fora porque os botões dele não estão no quadro.
- **Resposta pelo código** (spec 0096): `handleTopicMenu` (`tracking-chat-ai/lib/topic-menu-handler.ts`) acha a opção tocada e envia a resposta com o mesmo menu.
- **Fila de retomada do motor**: `runWorkflow` (`workflows/lib/run-workflow.ts`) já sabe continuar um fluxo a partir de uma fila de passos.
- **Menus salvos no editor**: `useAiButtonPresets` já entrega os menus do funil ao editor e ao Mapa.

## 2. Objetivo

Cada opção de um menu salvo enviado por um fluxo ganha um ponto de saída. Opção sem nada ligado continua igual a hoje. Opção com passos ligados faz o de hoje **e** roda esses passos.

### Não-objetivos

- Não muda a resposta do roteiro, o texto dos menus nem quem responde.
- Não transforma cada resposta em um passo de mensagem.
- Não cria tabela nem migration.
- Não vale para menu enviado pela assistente ou pelo menu inicial do atendimento: só para menu salvo enviado por um passo de fluxo.

## 3. Requisitos

- **RF-1** No editor e no Mapa, o quadro "Enviar Mensagem" que envia um menu salvo mostra todas as opções do menu (até 10), cada uma com um ponto de saída à direita.
- **RF-2** A saída de sempre do quadro (embaixo) continua existindo e continua valendo "depois de enviar o menu".
- **RF-3** Ligar um passo à saída de uma opção significa: quando o cliente tocar nessa opção, esses passos rodam.
- **RF-4** A resposta guardada no menu continua sendo enviada no toque, como hoje. Os passos ligados rodam depois dela. Opção sem resposta guardada (linha de ação) roda só os passos.
- **RF-5** Opção sem nada ligado: nenhum efeito novo.
- **RF-6** O toque vale quantas vezes o cliente tocar, porque o menu é reenviado a cada resposta. Cada toque roda os passos daquela opção.
- **RF-7** Um mesmo cliente não dispara os passos da mesma opção mais de uma vez em 60 segundos (toque duplo).
- **RF-8** Só roda se o fluxo dono do quadro estiver ligado.
- **RF-9** Se a opção deixar de existir no menu (menu refeito), a ligação fica em vermelho no editor com o aviso "Esta opção não existe mais no menu".
- **RF-10** Vale onde o menu de perguntas já responde hoje: número oficial e, com a opção de menu numerado ligada (spec 0095), número não oficial, em que a resposta com o número conta como toque.
- **RF-11** Fica atrás da mesma opção que já libera a saída por botão (`NEXT_PUBLIC_WORKFLOW_META_INTERACTIVE`). Desligada, o quadro tem a saída única de sempre e nenhum toque roda passo.
- **RF-12** Âncora e guia do Astro para a saída por opção (regra 21).

## 4. Critérios de aceite

- **CA-1** Quadro com menu salvo de 8 opções mostra 8 saídas, mais a saída de sempre.
- **CA-2** Com um passo "Tag" ligado à opção 2: o cliente toca na opção 2, recebe a resposta do roteiro e ganha a tag.
- **CA-3** O cliente toca na opção 3, sem nada ligado: recebe só a resposta, e nenhum passo roda.
- **CA-4** O cliente toca duas vezes seguidas na opção 2: a tag é aplicada uma vez; a resposta sai nas duas.
- **CA-5** Fluxo desligado: o toque não roda passo nenhum.
- **CA-6** Toque com id de opção de menu de outro funil: nenhum passo roda.
- **CA-7** Opção removida do menu: a ligação aparece em vermelho com o aviso da RF-9 e não roda.
- **CA-8** Opção `NEXT_PUBLIC_WORKFLOW_META_INTERACTIVE` desligada: quadro com uma saída só; toques respondem como hoje.
- **CA-9** Os seis fluxos da Clínica, sem nenhuma ligação nova, respondem exatamente como antes.

## 5. Casos de borda

- **CB-1** Dois fluxos ligados enviam o mesmo menu e os dois têm passos na mesma opção: os dois rodam. O editor avisa quando o menu é usado por mais de um fluxo.
- **CB-2** Os passos ligados incluem "Esperar" e depois uma mensagem: vale a regra da janela de 24 horas, e o diagnóstico que já existe avisa.
- **CB-3** O cliente toca numa opção de uma mensagem antiga, de dias atrás: a resposta sai (como hoje) e os passos rodam, se o fluxo estiver ligado.
- **CB-4** O menu é refeito e as perguntas mudam de ordem: o id da opção leva a posição, então a ligação passaria a apontar para outra pergunta. A ligação guarda também o título da opção; se o título não bater, cai na RF-9.
- **CB-5** Passo ligado falha: a resposta do roteiro já saiu; a falha aparece no histórico de execuções do fluxo.
- **CB-6** A mensagem do cliente chega enquanto os passos de um toque anterior ainda rodam: são execuções separadas, cada uma no seu limite.

## 6. Decisões de design

### D-1 — O toque começa os passos; o fluxo não fica parado esperando

A saída por botão que já existe pausa o fluxo e o retoma uma vez, no primeiro toque. No menu de perguntas o cliente toca várias vezes, e uma pausa de até 24 horas por cliente seguraria execuções abertas. Aqui cada toque inicia uma execução curta, a partir da saída daquela opção.

### D-2 — A resposta do roteiro continua saindo

O pedido é "um nó em cada resposta", não "trocar a resposta por um nó". Manter a resposta deixa o comportamento atual intacto e dispensa um interruptor a mais. Quem quiser só os passos apaga a resposta daquela opção no menu.

### D-3 — Achar o quadro pelo menu, sem gravar nada novo

No toque, o código procura, entre os fluxos ligados do funil, os quadros que enviam o menu daquela opção e têm ligação saindo dela. Não precisa marcar a mensagem enviada nem de coluna nova.

### D-4 — Mostrar todas as opções no quadro

Hoje a prévia corta em cinco e escreve "e mais 3". Com uma saída por opção, as dez precisam aparecer. A altura do quadro já é calculada pelo conteúdo (ajuste de 2026-10-11 na spec 0092).

### D-5 — Mesma opção de liberação da saída por botão

É a mesma família de recurso e o mesmo risco. Uma opção só evita combinações que ninguém testou.

## 7. Segurança

- O id do toque vem de fora. Só vale se for de uma opção de um menu salvo ativo **deste funil** e se o quadro for de um fluxo ligado **deste funil**.
- Os passos rodam com o lead da própria conversa; o toque não escolhe lead, funil nem empresa.
- Limite por cliente e por opção (RF-7), além do limite de execuções por hora que cada fluxo já tem.
- Nenhum dado novo chega ao cliente: o que é enviado continua sendo o texto do menu e o que os passos ligados já enviariam.
- O editor só mostra menus do próprio funil (rota com conferência de empresa, auditoria A8).

## 8. Regras da Meta

- O toque do cliente abre ou renova a janela de 24 horas; mensagens dos passos ligados saem dentro dela, sem cobrança e sem template.
- Passos com espera longa podem sair da janela: o diagnóstico de janela que já existe se aplica a esses caminhos.
- Limites mantidos: até 10 linhas por lista, título de linha com até 24 caracteres.
- O limite por toque (RF-7) evita mensagens repetidas, que geram bloqueio e denúncia.

## 9. O que fica para depois

- Saída "tocou em qualquer opção".
- Saída por opção no menu inicial do atendimento e em menus enviados pela assistente.
- Interruptor por opção para não enviar a resposta do roteiro.

## 10. Riscos e rollback

- **Risco**: o motor não começar bem uma execução no meio do fluxo. A confirmar na implementação; se a fila de retomada não servir, a spec é atualizada antes de seguir.
- **Risco**: ligação apontando para a pergunta errada depois de refazer o menu. Mitigado pela conferência do título (CB-4).
- **Rollback**: desligar `NEXT_PUBLIC_WORKFLOW_META_INTERACTIVE`. As ligações ficam gravadas e sem efeito.

## 11. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-11 | Weydson | Rascunho, a partir do desenho do Weydson (um ponto de saída por opção) e do "aprovado, pode escrever a spec do caminho 1". |
