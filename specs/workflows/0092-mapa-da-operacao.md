---
id: 0092
titulo: Mapa da operação — todos os fluxos do funil numa tela só
dominio: workflows
status: em-revisao
autor: Weydson
criada: 2026-10-11
atualizada: 2026-10-11
branch: feature/workflows-simulador-visual-20261010
pr: Act962/nasa.ex#454
peso: leve
---

# 0092 — Mapa da operação

## 1. Contexto

A página "Gatilhos Automáticos" do funil é uma lista: para entender a operação é preciso abrir fluxo por fluxo. No funil Suporte da Clínica Tércio Rezende são 9 fluxos, e a lista mostra uma linha de texto para cada um. O Weydson pediu para ver a operação inteira numa tela só, com cada fluxo dentro de um retângulo azul tracejado, o nome em cima, os passos dentro e a etapa do funil ("Tracking > Status") a que aquele trecho pertence.

O levantamento também achou dois furos: `workflow.getOne` e `workflow.update.updateNodes`/`updateName` só conferiam se a pessoa estava logada, não se o fluxo era da empresa dela.

## 2. Objetivo

Quem cuida do funil enxerga todos os fluxos e seus passos numa tela, sabe em que etapa do funil cada trecho acontece, e ninguém de fora da empresa lê ou grava um fluxo.

## 3. Escopo

**Entra (etapa 0 e etapa 1)**

- Etapa 0: leitura e gravação de fluxo só para membro da empresa dona do funil (ou do workspace) do fluxo.
- Chave "Lista | Mapa" na página de fluxos do funil. A lista continua sendo o padrão.
- Mapa: um retângulo por fluxo, com nome, pasta, etapa do funil, estado, interruptor de ligar, contagem de problemas e os passos desenhados dentro, somente leitura. Retângulos arrastáveis; posição guardada no navegador de cada pessoa.
- Trechos por etapa do funil: o gatilho define o primeiro; cada "Mover Lead" com coluna escolhida abre o seguinte. No mapa e no editor de um fluxo.
- Gatilho `MOVE_LEAD_STATUS` passa a se chamar "Lead entrou na coluna" (só o rótulo).

**Não entra (fica para a etapa 2, atrás de `NEXT_PUBLIC_WORKFLOW_MAP_EDIT`)**

- Editar passos no mapa, ligar um retângulo no outro ("terminou um, roda o outro", via `CALL_WORKFLOW`), o "+" na saída do retângulo e a posição compartilhada entre a equipe (pede migration).
- Linhas automáticas por tag ou por coluna entre fluxos.
- Mapa das automações do workspace e do Comments.

## 4. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | `getOne`, `updateNodes` e `updateName` respondem "não encontrado" para quem não é membro da empresa do fluxo, igual a fluxo inexistente |
| RF-2 | O mapa usa só `workflow.list`, que já confere a empresa; `agentMode` passa a vir no retorno |
| RF-3 | Um retângulo por fluxo; fluxos da mesma pasta ficam juntos; nenhum retângulo sobre outro na disposição automática |
| RF-4 | Os passos aparecem na mesma disposição do editor, no desenho da visão escolhida (Ícones ou Visual), sem barra de botões nem janela de configuração |
| RF-5 | Retângulo e passos em vermelho seguem a mesma conta de problemas do editor (`collectFlowProblems`) |
| RF-6 | Ligar pelo mapa segue a trava do editor: com erro previsto não liga; desligar é sempre permitido |
| RF-7 | Etiqueta "Tracking > Status": do gatilho "Lead entrou na coluna" sai a coluna; dos demais, "qualquer etapa". "Mover Lead" com coluna escolhida abre um trecho novo com o destino, que pode ser outro tracking |
| RF-8 | Os trechos são só desenho: nada é gravado e a execução não muda |
| RF-9 | No mapa, linhas e contornos ficam parados, para não pesar com muitos fluxos na tela |

### Segurança

- RF-1 fecha a leitura e a gravação de fluxo por quem não é da empresa. Vale para o editor de hoje.
- Nenhum dado novo sai do servidor para o mapa. Posição dos retângulos fica só no navegador.

### Regras da Meta

Nada no mapa envia mensagem. O vermelho repete as regras já previstas na 0090.

## 5. Critérios de aceite

- [x] **CA-0** — Membro da empresa acessa o fluxo; usuário de outra empresa e fluxo inexistente recebem a mesma recusa (`scripts/verify-workflow-access.ts`).
- [x] **CA-1** — Um retângulo por fluxo, agrupados por pasta; fluxo sem passos vira retângulo vazio.
- [x] **CA-2** — Todo passo fica dentro do seu retângulo e os ids não colidem entre fluxos.
- [x] **CA-3** — Retângulos não se sobrepõem na disposição automática.
- [x] **CA-4** — Posição arrastada pela pessoa vale no lugar da automática.
- [x] **CA-5** — Trechos por etapa: sem "Mover Lead" é um só; "Mover Lead" configurado abre o seguinte; sem coluna não abre; dois em sequência dão três; passo em dois caminhos cai num só; gatilho de coluna dá a etiqueta da coluna.
- [x] **CA-6** — Todos os fluxos salvos no banco de desenvolvimento viram mapa sem erro.
- [x] **CA-8** — Regras de ligação entre fluxos: só modo agente, sem repetir, sem círculo (direto ou por fluxo intermediário), no máximo 5 passagens, só fluxos do mesmo funil (`scripts/verify-flow-links.ts`).
- [x] **CA-9** — A ligação do mapa é lida do passo de passagem; chamada embutida antiga não vira ligação.
- [x] **CA-10** — "Terminou A, rodou B" de verdade, com o Inngest local ligado (`scripts/verify-flow-handoff.ts`, 2026-10-11): A terminou em 5 s, B começou sozinho pelo gatilho dele (`LEAD_TAGGED`), ficou suspenso na espera de 1 minuto e terminou aos 68 s, com o passo depois da espera executado. Os fluxos do teste só mexiam em tags; nenhuma mensagem saiu. **Não coberto por este teste**: a rota `linkFlows` chamada pela tela (o passo de passagem foi criado direto no banco, com os mesmos dados que a rota grava).
- [ ] **CA-11** — Editar um fluxo sem sair do mapa: clicar num passo, o lápis do retângulo ou "Adicionar um passo" abre o editor por cima; salvar e fechar atualiza o mapa; fechar com alteração pendente pede confirmação. **Não verificado** (conferência visual do Weydson).
- [ ] **CA-7** — Na tela: a chave Lista | Mapa, os retângulos, as etiquetas, o arrastar e os retângulos de etapa no editor. **Não verificado** (conferência visual do Weydson).

CA-1 a CA-6: `scripts/verify-operation-map.ts` (15 verificações).

## 9. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-11 | Weydson | Criada com as etapas 0 e 1 implementadas. Arquivos: `workflows/server/workflow-access.ts`; `workflows/lib/{flow-stage-sections,operation-map-graph,flow-problems}.ts`; `workflows/components/operation-map/*`; `editor/components/stage-sections-layer.tsx`. A conta de problemas do editor saiu de dentro de `editor.tsx` para `flow-problems.ts`, para o mapa pintar igual. Decisões do Weydson: um retângulo por fluxo; entrega em duas etapas; ligar retângulos significa "terminou um, roda o outro"; etiqueta "Tracking > Status" e retângulo novo a cada "Mover Lead". Achado registrado e fora do escopo: a ação "Tag" de um fluxo parece não disparar o gatilho "Lead com Tag" de outro, por isso o mapa não desenha linha automática por tag |
| 2026-10-11 | Weydson | **Etapa 2, parte 1, atrás de `NEXT_PUBLIC_WORKFLOW_MAP_EDIT`** (aprovada a etapa 1). Ligar fluxos pelo mapa: arrastar da saída de um retângulo até a entrada de outro, ou pelo "+" na saída. Rotas `workflow.linkFlows`/`unlinkFlows` (`router/workflow/link-flows.ts`) acrescentam ou removem, no fim do fluxo de origem, um passo "Chamar sub-fluxo" em **modo passagem** (`mode: "handoff"`), ligado a todo fim de caminho; exigem acesso aos dois fluxos, mesmo funil e permissão de editar automações. **Mudança de desenho em relação ao plano**: a chamada embutida que já existia roda o destino só se ele tiver gatilho manual e para na primeira espera dele; por isso a passagem dispara o destino como execução própria (`sendWorkflowExecution`), começando pelo gatilho que ele tiver. É um modo novo: passos "Chamar sub-fluxo" antigos não mudam. O destino precisa estar ligado; se não estiver, o passo falha com a explicação. O executor passou a recusar fluxo de destino de outra empresa (valia para qualquer id colado). O formulário do passo ganhou seletor de fluxos no lugar de colar o id. **Ficou de fora desta parte**: editar passos dentro do mapa (o "+ Adicionar um passo" e o duplo clique abrem o editor do fluxo) e a posição compartilhada dos retângulos (pede migration) |
| 2026-10-11 | Weydson | Teste real da passagem aprovado (CA-10). O Inngest local foi ligado só para o teste e desligado em seguida; os fluxos e as tags de teste foram apagados |
| 2026-10-11 | Weydson | **Etapa 2, parte 2 — editar sem sair do mapa** (mesmo interruptor). Clicar num passo, no lápis do retângulo, no "Adicionar um passo" do "+" ou dar duplo clique abre o **editor de sempre por cima do mapa** (`operation-map/map-flow-editor.tsx`), com cabeçalho, salvar, configurar, adicionar e ligar passos. **Mudança em relação ao plano**: o plano previa editar os passos soltos dentro do próprio canvas do mapa, com um salvar por retângulo. Não foi feito assim porque os quadros e as janelas de configuração são presos ao editor de um fluxo só (estado, ids, diagnóstico, modo do fluxo); reescrever isso para vários fluxos ao mesmo tempo era o maior risco de quebrar o salvamento. Reaproveitar o editor inteiro mantém o caminho de gravação que já existe, sem código novo de salvar. Ao fechar, a lista é buscada de novo e o mapa mostra o que foi salvo; com alteração pendente, pede confirmação. O ícone de abrir continua levando à página do fluxo |
| 2026-10-11 | Weydson | **Mais furos do mesmo tipo fechados, a pedido.** Pastas de fluxos (`router/workflow-folder/`): `list`, `create`, `update`, `delete` e `moveWorkflow` só conferiam se a pessoa estava logada. Fluxos (`router/workflow/`): o mesmo em `create`, `delete`, `execute`, `dryRun`, `validate`, `stepNode`, `listRuns`, `getRun` e `update.updateAgentMode`. Todas passam a exigir ser membro da empresa dona do funil (ou do fluxo), com a mesma resposta de registro inexistente (`canAccessWorkflow`, `canAccessTracking`). Não muda nada para quem é da empresa. Já conferiam: `list`, `duplicate`, `createFromBlueprint`, `update.updateIsActive`, `quick.*`, `linkFlows` |
| 2026-10-11 | Weydson | **Permissão fina de Automações em todas as rotas de fluxo e de pasta, a pedido.** Além de ser da empresa, vale a matriz de Configurações › Permissões: "Tracking (Automações)" para fluxo de funil e "Workspace (Automações)" para fluxo de workspace (`checkWorkflowAccess`, `checkTrackingAutomationsAccess`). **Ver**: listar fluxos, abrir fluxo, execuções e detalhe, validar, listar pastas. **Criar**: criar fluxo, duplicar, modo rápido, criar por blueprint, criar pasta. **Editar**: salvar passos, renomear, trocar modo, ligar e desligar, executar, testar, passo a passo, renomear pasta, mover de pasta, ligar fluxos. **Excluir**: excluir fluxo e pasta. Quem é de fora continua recebendo "não encontrado"; membro sem a permissão recebe "proibido" com a frase que diz a quem pedir. **Efeito com os padrões de hoje, em empresa que nunca personalizou a matriz** (conferido no banco de desenvolvimento): dono pode tudo; **admin e moderador deixam de poder excluir** fluxo e pasta; **membro deixa de poder editar** (salvar, ligar e desligar, testar, renomear, mover) **e excluir**, e continua vendo e criando. Antes, qualquer pessoa logada podia tudo. É mudança de comportamento em produção: avisar o João antes do deploy. As telas ainda mostram os botões para quem não pode; a recusa chega como erro ao clicar. A regra não olha se a pessoa participa daquele funil |
| 2026-10-11 | Weydson | **Botões seguem a permissão, a pedido** (`workflows/hooks/use-automation-permissions.ts`, sobre o `useCheckPermission` que já existia). Sem **criar**: somem "Novo", "Modo rápido", "+ Automação", "Nova pasta" e "Duplicar". Sem **editar**: o interruptor de ligar fica travado na lista, no editor e no mapa; o "Salvar" do editor vira o selo "Somente leitura"; somem "Mover para", "Renomear" pasta e, no mapa, o lápis, o "+" e o arrastar para ligar. Sem **excluir**: somem a lixeira do editor e o "Excluir pasta". Menu que ficaria vazio não aparece. É só espelho na tela: quem barra é o servidor. **Limite**: dentro do editor, quem não pode editar ainda consegue mexer no desenho e abrir a configuração dos passos; só não consegue salvar. Vale a permissão "Tracking (Automações)"; o editor do workspace não foi alterado |
| 2026-10-11 | Weydson | **Editor travado para quem não pode editar, a pedido** (`editorReadOnlyAtom`). Sem a permissão de editar Automações: os quadros não se movem, não se ligam nem se religam, a tecla de apagar não age, o duplo clique e a barrinha do quadro não abrem configuração, somem o "+" da saída, a barrinha da ligação, o menu do botão direito, "Organizar" e a engrenagem (histórico, testar passo a passo, clipboard). Continua dando para navegar, dar zoom, ver os problemas e trocar Ícones/Visual. O afastamento automático de quadros sobrepostos não roda nesse modo, para não acusar alteração pendente. Segue sendo espelho da regra do servidor |
| 2026-10-11 | Weydson | **Disposição do mapa sem sobreposição.** O Weydson relatou os retângulos desorganizados na visão Visual. Causas: a posição arrastada era guardada uma vez só e valia para Ícones e Visual, onde o mesmo fluxo tem tamanhos diferentes (um de dois passos: 496×220 e 632×406); e os retângulos não arrastados eram dispostos sem considerar os arrastados. Ajuste em `operation-map-graph.ts`: os arrastados viram obstáculo e os demais se encaixam em volta; dois arrastados sobrepostos se afastam; dentro de cada fluxo, passos que ficariam um sobre o outro na visão Visual abrem espaço (`resolveOverlaps`); a ordem passou a ser pasta, ativos primeiro e nome. Em `operation-map.tsx`, cada visão guarda a própria disposição (a de Ícones mantém a chave antiga, então ninguém perde o que arrastou). `scripts/verify-operation-map.ts` foi de 15 para 19 verificações. Conferido com os 9 fluxos reais da Clínica: zero sobreposições na disposição automática e no pior caso (posições de Ícones aplicadas em Visual). **Não conferido na tela**: o navegador interno estava deslogado |
| 2026-10-11 | Weydson | **O menu do atendimento entra no mapa, ligado aos fluxos.** O Weydson perguntou por que os retângulos não apareciam interligados nem existia um retângulo do menu. Causa: o menu é um menu salvo do atendimento (não um fluxo) e liga aos fluxos de forma indireta, pela tag que cada opção aplica; o mapa só desenhava a passagem direta entre fluxos. Leiaute aprovado e implementado: `workflows/lib/operation-map-attendance.ts` (puro) descobre, pela tag, a qual fluxo cada opção leva, e também as ligações fluxo → fluxo por tag; `operation-map/attendance-map-nodes.tsx` desenha o retângulo do menu com uma saída por opção, o bloco "Agendamento por botões" (quando o funil marca por botões) e o bloco "Assistente (IA)". Entram todos os menus salvos ativos que levam a algum fluxo, mais o menu do roteiro. Os fluxos ligados ao menu passam a vir primeiro, na ordem das opções. Tudo só leitura: o clique leva à tela de configuração de cada um. `scripts/verify-operation-map.ts` foi de 19 para 29 verificações. Conferido com os dados da Clínica: as seis opções ligam aos seis fluxos de assunto, mais as duas linhas de agendamento. **Não conferido na tela.** Diferença do leiaute: os retângulos novos não podem ser arrastados |
| 2026-10-11 | Weydson | **"Organizar" inteligente e linhas retas, depois do print do Weydson ("isso ficou uma bagunça").** Na primeira versão as linhas do menu eram curvas e os fluxos ficavam em fileiras de três, então a linha atravessava o primeiro retângulo para chegar ao segundo, e as da assistente cruzavam tudo. Refeito: (1) os fluxos que respondem ao menu ficam em **duas colunas, uma de cada lado do menu**, na ordem das opções, alternando os lados (até três fluxos, um lado só); o menu, o bloco de agendamento e o da assistente ficam no meio, centrados na altura das colunas; os demais fluxos vão para baixo de tudo. (2) Toda ligação entre retângulos é **reta, em ângulo reto**: sai da opção, anda até um corredor próprio entre o menu e a coluna, sobe ou desce e entra no fluxo. De cada lado, quem sobe e quem desce usa faixas na ordem que impede cruzamento. As linhas de agendamento descem retas para o bloco logo abaixo do menu. A passagem entre fluxos ("depois segue para") também deixou de ser curva. (3) As linhas da assistente saíram: o bloco fica abaixo do menu, sem linhas. `operation-map-graph.ts` (`menuColumns`), `operation-map-attendance.ts` (`placeAttendance`, lados e corredores), `straight-path.ts`. `scripts/verify-operation-map.ts` foi a 42 verificações, incluindo "nenhuma linha do menu cruza outra" e "nenhum retângulo em cima de outro"; `scripts/render-operation-map.ts` desenha o resultado num SVG para conferir sem abrir a tela (usado com os dados da Clínica). Posição arrastada continua valendo: é o botão "Organizar" que volta para esta disposição |
| 2026-10-11 | Weydson | **Mapa e Visual como padrão, mapa sempre organizado ao voltar, e nenhum retângulo em cima de outro.** Pedido do Weydson depois de ver na tela dois fluxos sobrepostos (posições antigas guardadas no navegador entravam em cima da coluna nova). (1) O padrão de quem nunca escolheu passa a ser "Mapa" (`workflowsViewAtom`) e "Visual" (`editorViewModeAtom`, que vale também no editor de fluxo); quem já escolheu Lista ou Ícones mantém a escolha. (2) O que a pessoa arrasta no mapa passa a valer **só durante a visita**: saiu e voltou, o mapa abre organizado. A posição deixou de ser guardada no navegador (muda a CA-4: "posição arrastada vale" agora é dentro da visita). (3) `layoutOperationMap` (em `operation-map-graph.ts`) passou a posicionar primeiro as colunas do menu, reservar o espaço do menu e dos blocos do meio, e só então os arrastados: quem é solto em cima de outro fluxo ou do menu desce até caber. O menu fica centrado numa altura que a própria disposição devolve (`centerY`), a mesma usada para reservar o espaço. `scripts/verify-operation-map.ts` foi a 46 verificações, com quatro casos novos de soltar em cima de fluxo, de menu e de todos no mesmo ponto |
