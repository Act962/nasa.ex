---
id: 0097
titulo: Modelo de atendimento por menu para toda empresa nova
dominio: tracking-chat-ai
status: aprovada
autor: Weydson
criada: 2026-10-11
atualizada: 2026-10-11
branch: feature/workflows-simulador-visual-20261010
pr:
peso: completa
---

# 0097 — Modelo de atendimento por menu para toda empresa nova

## 1. Contexto

A Clínica tem um atendimento completo: menu inicial com os assuntos, um fluxo por assunto, um menu de perguntas por assunto respondido pelo código (spec 0096) e agendamento por botões (spec 0089). Quem abre o Mapa do funil dela entende em segundos como o atendimento funciona.

Uma empresa que acabou de se cadastrar abre o mesmo Mapa e vê uma tela vazia. O pedido do Weydson: "Quero que toda empresa que se cadastre já venha com o modelo de menu igual ao da clínica, para o usuário que não sabe como mexer, já ter uma visão de como funciona." E, para as que já existem: "ganha botão".

O que já existe e será reaproveitado (nada de tabela, cron ou integração nova):

- `seedNewOrganization` (`features/org-defaults/lib/seed-new-organization.ts`) cria os cinco funis da empresa nova e dispara `org-defaults/sample-content.seed`, que roda um semeador por App (`sample-content/*.ts`).
- `interestTags`, `menuTitles`, `buildInterestFlowBlueprint`, `MENU_PRESET_NAME`, `flowName` (`attendance-setup/script-draft.ts`) e `createWorkflowFromBlueprint` montam tags, menu e fluxos a partir de um rascunho escrito à mão, sem IA.
- `saveTopicMenus` e `switchTopicMenus` (`attendance-setup/build-topic-menus.ts`) gravam os menus de perguntas e os ligam aos fluxos.
- `AiButtonPreset` guarda os menus; `diagnoseFlow` (`workflows/lib/flow-diagnostics.ts`) já pinta de vermelho e trava a ativação de fluxo com erro.

## 2. Objetivo

Todo funil "Atendimento" de empresa nova nasce com um atendimento de exemplo, desligado, que aparece completo no Mapa. Empresa que já existe cria o mesmo modelo com um botão, no funil que escolher.

### Não-objetivos

- Não liga nada sozinho: nenhum cliente recebe o modelo sem alguém preencher e ligar.
- Não gera texto com IA. O conteúdo é fixo, de exemplo, e não custa nada.
- Não mexe nas instruções, no nome da assistente nem nos documentos do funil.
- Não cria o modelo nos outros quatro funis da empresa nova (Vendas, Entrega, Financeiro, Jurídico).
- Não cria nada sozinho em empresa que já existe.

## 3. Requisitos

- **RF-1** O modelo tem: um menu inicial com três assuntos ("Conhecer os serviços", "Preços e pagamento", "Horários e endereço"); uma tag de interesse por assunto; um fluxo por assunto ("Interesse em {assunto}"), que envia a abertura com o menu de perguntas; um menu de perguntas por assunto, com três perguntas e respostas de exemplo.
- **RF-2** Todo texto que a empresa precisa trocar vem entre colchetes e começa por "Escreva aqui": "[Escreva aqui como funciona o seu serviço]".
- **RF-3** Tudo nasce desligado: os três fluxos, o menu inicial e os três menus de perguntas.
- **RF-4** Empresa nova: o modelo é criado no funil "Atendimento" logo depois do cadastro, pelo semeador de conteúdo de exemplo que já existe.
- **RF-5** Empresa que já existe: botão "Criar modelo de atendimento" na página de fluxos do funil. Antes de criar, uma janela diz o que será criado e que tudo vem desligado.
- **RF-6** Criar duas vezes não duplica: o que já existe com o mesmo nome no funil é mantido como está, e a janela avisa "este funil já tem o modelo".
- **RF-7** Funil que já tem menu inicial do roteiro (spec 0091) não recebe o modelo: o botão explica que o funil já tem atendimento por menu.
- **RF-8** Trava: fluxo ou menu com texto de exemplo ("[Escreva aqui…]") não liga. No editor e no Mapa o passo aparece em vermelho com o aviso "Troque o texto de exemplo". O servidor recusa a ativação, e não só a tela.
- **RF-9** Última barreira: o envio pelo atendimento nunca manda ao cliente um texto com "[Escreva aqui". Se chegar a esse ponto, a mensagem não sai e o erro vai para o registro.
- **RF-10** Só dono e admin da empresa criam o modelo pelo botão.
- **RF-11** O Astro ganha âncora e guia para o botão (regra 21).

## 4. Critérios de aceite

- **CA-1** Empresa recém-criada: o funil "Atendimento" tem três fluxos "Interesse em …", o menu inicial e três menus "Perguntas: …", todos desligados.
- **CA-2** O Mapa desse funil mostra o retângulo do menu ligado aos três fluxos.
- **CA-3** Rodar a criação duas vezes no mesmo funil deixa a mesma contagem de fluxos, menus e tags.
- **CA-4** Tentar ligar um fluxo do modelo sem trocar os textos é recusado pelo servidor.
- **CA-5** Tentar ligar o menu inicial ou um menu de perguntas com texto de exemplo é recusado pelo servidor.
- **CA-6** Depois de trocar todos os textos de um fluxo e do menu dele, ligar funciona.
- **CA-7** Membro que não é dono nem admin recebe recusa ao criar; funil de outra empresa é recusado.
- **CA-8** Funil com menu do roteiro: a criação é recusada e nada é gravado.
- **CA-9** Os outros quatro funis da empresa nova continuam sem fluxos.
- **CA-10** Um texto com "[Escreva aqui" não é enviado pelo atendimento, mesmo com tudo ligado à força no banco.

## 5. Casos de borda

- **CB-1** O semeador falha no meio (ex.: banco fora): o cadastro da empresa não é afetado; rodar de novo completa o que faltou (RF-6).
- **CB-2** A empresa apaga um dos três fluxos e clica no botão de novo: só o que falta é recriado.
- **CB-3** A empresa renomeia um fluxo do modelo: ele deixa de ser reconhecido pelo nome e o botão criaria outro. A janela mostra o que será criado antes de confirmar.
- **CB-4** Empresa nova sem funil chamado "Atendimento" (modelo de funis alterado no futuro): o semeador não cria nada e registra o motivo.
- **CB-5** A empresa usa colchetes num texto de verdade ("[Promoção]"): não trava, porque a trava procura "[Escreva aqui".
- **CB-6** Número não oficial: os menus saem como texto numerado (spec 0095); o modelo é o mesmo.

## 6. Decisões de design

### D-1 — Só o funil "Atendimento" da empresa nova

A empresa nova nasce com cinco funis. Pôr o modelo nos cinco criaria quinze fluxos de exemplo e esconderia o que importa. O modelo vai no funil cujo assunto é atendimento; nos demais, o botão fica disponível.

### D-2 — Conteúdo fixo, sem IA

Uma empresa nova não tem roteiro. Gerar um texto "parecido com o negócio dela" custaria uma chamada de IA por cadastro e produziria respostas inventadas com cara de verdadeiras. Texto entre colchetes é honesto: mostra a forma e deixa claro o que falta.

### D-3 — Trava em três camadas

Tudo desligado (RF-3), recusa no servidor ao ligar (RF-8) e barreira no envio (RF-9). O risco aqui é um cliente receber "[Escreva aqui…]"; uma camada só, na tela, não basta, porque hoje a recusa de ativação com erro existe apenas no navegador.

### D-4 — Sem marca "Modelo" no banco

Não existe campo que marque um fluxo como modelo, e criar um pediria migration. O modelo é reconhecido pelo que ele tem: texto de exemplo. Quando a empresa troca os textos, ele vira um fluxo comum, que é o comportamento desejado.

### D-5 — Não reaproveitar `applyScriptDraft` inteiro

Ele cria o menu ligado, grava um documento de conhecimento e pode trocar as instruções da assistente. O modelo usa as peças menores dele (tags, títulos, desenho do fluxo) e grava os menus desligados.

### D-6 — A recusa do servidor vale só para o texto de exemplo

Recusar no servidor todos os erros do diagnóstico mudaria o comportamento de fluxos que já existem em produção. Esta spec acrescenta só a regra nova; estender a recusa aos demais erros fica para depois, com contagem em produção.

## 7. Segurança

- A criação pelo botão confere empresa, funil e papel (dono ou admin) no servidor.
- O modelo não lê nem copia dado de outra empresa: o conteúdo é uma constante do código.
- Nenhuma chave, variável de ambiente ou dado de cliente entra nos textos.
- As três camadas da D-3 impedem que texto de exemplo chegue a um cliente.
- As tags de interesse são da empresa; o modelo não cria tag com descrição para a IA aplicar sozinha enquanto estiver desligado.

## 8. Regras da Meta

- Nada é enviado na criação.
- Depois de ligado, o modelo usa mensagens interativas (lista e botões) dentro da janela de 24 horas, que não são cobradas e não exigem template.
- Limites respeitados pelo conteúdo fixo: título de linha com até 24 caracteres, até 10 linhas por lista, corpo com até 1.024 caracteres.
- A barreira da RF-9 evita mandar texto sem sentido, que gera bloqueio e denúncia por parte do cliente.

## 9. O que fica para depois

- Assuntos de exemplo diferentes por tipo de negócio.
- O Astro preencher os textos do modelo a partir de uma conversa.
- Tela para editar as respostas dos menus de perguntas (hoje se edita em Menus de botões do funil).

## 10. Riscos e rollback

- **Risco**: empresa nova estranhar fluxos que não pediu. Mitigação: três fluxos, desligados, só no funil de atendimento.
- **Risco**: a recusa nova travar um fluxo real que contenha "[Escreva aqui". Improvável; a contagem em produção é feita antes do merge.
- **Rollback**: tirar o semeador da lista e esconder o botão. O que já foi criado fica desligado e pode ser apagado pela própria empresa.

## 11. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-11 | Weydson | Rascunho, a partir do pedido "toda empresa que se cadastre já venha com o modelo de menu igual ao da clínica" e da decisão "as que já existem ganha botão". |
| 2026-10-11 | Weydson | **Aprovada e implementada** ("aprovado, pode implementar"). Conteúdo em `attendance-setup/attendance-template.ts`; gravação em `apply-attendance-template.ts` (dentro de transação, tudo desligado); semeador `org-defaults/lib/sample-content/attendance-template.ts`; rota `ia.attendanceTemplate.create` (dono e admin da empresa do funil); botão `tracking-chat-ai/components/attendance-template-button.tsx`; âncora `trackingFlowsAttendanceTemplate` e guia `tracking.attendance-template`. Trava: regra `PLACEHOLDER_TEXT` em `collectFlowProblems` (editor e Mapa, olhando também o menu salvo que o passo envia), recusa em `workflow/update-is-active.ts` e em `ia/update-ai-button-preset.ts`, e barreira no envio (`send-buttons.ts` e `send-message/executor.ts`). **Divergências do rascunho**: (1) o menu inicial do modelo não tem texto de exemplo (a saudação usa o nome da empresa), então a trava da CA-5 vale para os menus de perguntas; o menu inicial ligado sozinho só leva a fluxos desligados. (2) Os fluxos já nascem enviando o menu de perguntas do assunto, e ligar o fluxo liga junto esse menu, se ele estiver sem texto de exemplo: desligado, o passo de envio falharia. (3) O Mapa passou a mostrar o menu inicial mesmo desligado (borda tracejada, "Desligado"); antes, menu desligado não aparecia e o modelo ficaria sem o desenho. (4) Funil com menu inicial próprio é reconhecido pelas opções: se nenhuma é do modelo, a criação é recusada. **Verificado** por `scripts/verify-attendance-template.ts` num funil temporário do banco de desenvolvimento (15 de 15): CA-1, CA-2, CA-3, CA-4, CA-6, CA-8 e CB-2. **Não verificado por teste**: CA-5 e CA-7 (recusas das rotas, que exigem sessão), CA-9 (o semeador só procura o funil "Atendimento"; conferido por leitura), CA-10 (barreira no envio) e o cadastro real de uma empresa nova. |
