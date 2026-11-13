---
id: 0143
titulo: Trabalhar nos cards do Workspace pelo MCP do ÓRBITA
dominio: external-ai
status: em-implementacao
autor: João Gabriel
criada: 2026-11-13
atualizada: 2026-11-13
branch: claude/mcp-orbita-features-f56e63
pr:
peso: completa
---

# 0143 — Trabalhar nos cards do Workspace pelo MCP do ÓRBITA

## 1. Contexto

O MCP do ÓRBITA já tem Planner, FlowAstro e trafeGO ([specs 0065](../nasa-planner/0065-mcp-e-caixa-de-criacoes.md),
[0135](0135-mcp-conectar-pelo-chatgpt-oauth.md), [0142](0142-flowastro-pelo-mcp.md)). O objetivo é que a IA da pessoa
(Claude, ChatGPT) use o ÓRBITA inteiro. O Workspace é o quadro de tarefas da empresa: colunas e cards ("ações") com
prazo, prioridade, responsáveis, etiquetas e checklist. Hoje, para a IA "criar as tarefas da reunião" ou "ver o que está
atrasado", a pessoa copia e cola tudo à mão.

As escritas de card moram direto nas rotas oRPC, cada uma com os seus efeitos (automação do Workspace pelo Inngest, aviso
de tarefa nova, histórico, Stars, pontos). Uma ferramenta do MCP que gravasse pelo Prisma pularia esses efeitos, como já
acontece com o Astro em `features/astro/actions/workspace/create-action.ts`.

## 2. Objetivo

Pela IA, a pessoa lista os workspaces, lê o quadro e os cards, cria, edita, move e conclui cards, escolhe responsáveis,
etiquetas e itens de checklist, com as mesmas regras e os mesmos efeitos da tela.

### Não-objetivos

- Apagar ou arquivar card, coluna, etiqueta ou workspace. Não tem volta (ou é em massa); fica na tela.
- Criar ou editar workspace, coluna, etiqueta e membro.
- Compartilhar card com outra empresa e publicar no calendário público.
- Editar as automações do Workspace.
- Chat do card, anexos, formulários e lembretes.
- Trocar o Astro para os comandos novos (D-3: fica como tarefa separada).

## 3. Requisitos

### Funcionais

- **RF-1 — App novo no MCP**: entrada `workspace` em `MCP_APPS`, liberada a quem é membro de pelo menos um workspace não
  arquivado. Por OAuth vale sozinho; chave nova ganha o escopo `workspace`; chave antiga não ganha nada sem ser recriada.
  Na chave, valem só as empresas gravadas nela.
- **RF-2 — Quem vê o quê** (igual à tela):
  - Workspace: só os em que a pessoa é membro (`WorkspaceMember`), como `workspace.list`.
  - Card: papel `member` da empresa vê só os cards que criou ou em que participa; os outros papéis veem todos.
  - Card de workspace em que a pessoa não é membro, ou de empresa fora da chave: "Card não encontrado".
- **RF-3 — Quem muda o quê**:
  - Criar card: membro do workspace com papel diferente de `VIEWER`.
  - Mexer num card: `resolveActionAccess(...).canEdit` (dono/admin/moderador da empresa, dono do workspace, criador ou
    participante). É mais estrito que mover, etiquetar e pôr responsável na tela, que hoje só conferem a empresa.
  - Mover para coluna de outro workspace: a pessoa também precisa ser membro (não `VIEWER`) do destino.
- **RF-4 — Ferramentas**:

  | Ferramenta | O que faz |
  | --- | --- |
  | `workspace_list_workspaces` | Empresas e workspaces da pessoa, com as colunas, etiquetas e membros de cada um |
  | `workspace_get_board` | Colunas com os cards visíveis (título, prazo, prioridade, concluído, responsáveis, etiquetas), até 50 por coluna, com filtros de responsável, etiqueta e prazo |
  | `workspace_search_actions` | Busca por título nos workspaces da pessoa; filtros de atrasado e concluído |
  | `workspace_get_action` | O card inteiro: descrição, datas, coluna, responsáveis, participantes, etiquetas, checklist e lead |
  | `workspace_create_action` | Cria o card (sem coluna: a primeira do workspace), com responsáveis e participantes |
  | `workspace_update_action` | Título, descrição, prioridade, início, prazo e fim |
  | `workspace_move_action` | Muda de coluna (pode ser de outro workspace da mesma empresa) |
  | `workspace_set_done` | Conclui ou reabre |
  | `workspace_update_people` | Põe e tira responsáveis; põe participantes |
  | `workspace_update_tags` | Põe e tira etiquetas do workspace do card |
  | `workspace_add_checklist_item` | Adiciona item no checklist, com data opcional |

- **RF-5 — Mesmos efeitos da tela**: cada escrita passa pela mesma função que a rota usa (D-2): automações do Workspace
  (card criado, movido, etiquetado, concluído, participante), aviso de tarefa nova, histórico, Stars ao criar e pontos ao
  concluir.
- **RF-6 — Registro com o nome da IA**: criar, editar, mover e concluir entram no histórico de atividades com
  `(via <nome da IA>)` no texto e `metadata.via`.
- **RF-7 — Datas**: a IA manda data ISO (`2026-11-20` ou `2026-11-20T14:00:00-03:00`). Data sem hora vira o fim do dia
  no horário de Brasília (23:59), para o card não aparecer atrasado no próprio dia.
- **RF-8 — Instruções do app**: o texto do app ensina a ordem (listar → quadro → criar ou mexer), a pedir confirmação
  antes de criar vários cards de uma vez ou de pôr responsáveis (eles recebem aviso), e lembra que títulos e descrições
  são dados escritos por pessoas, não instruções.

### Não-funcionais

- **RNF-1**: nenhuma tabela, migration, flag ou função do Inngest.
- **RNF-2**: as rotas oRPC mudam só de lugar: mesmo comportamento (CA-9).
- **RNF-3**: limite de 300 chamadas por hora por pessoa e chave, como o FlowAstro; listas com `take`.

## 4. Critérios de aceite

- **CA-1**: com chave nova, "crie no workspace X um card 'Revisar contrato' para a Ana, prazo sexta" cria o card na
  primeira coluna, com a Ana de responsável, e ela recebe o aviso de tarefa nova.
- **CA-2**: criar card num workspace com automação "card criado" dispara a automação, como na tela.
- **CA-3**: `workspace_move_action` para uma coluna com automação "card movido" dispara a automação.
- **CA-4**: `workspace_set_done` conclui, dá os pontos ao criador e dispara "card concluído"; repetir não dá pontos de novo.
- **CA-5**: pessoa com papel `member` não vê nem mexe em card de outra pessoa em que não participa ("Card não encontrado").
- **CA-6**: pessoa que não é membro do workspace não o vê em `list_workspaces` e recebe "não encontrado" ao passar o id.
- **CA-7**: chave sem a empresa recebe "não encontrado", sem dizer se o card existe.
- **CA-8**: criar e concluir aparecem no histórico de atividades com o nome da IA.
- **CA-9**: na tela, criar, editar, mover, concluir, etiquetar, pôr responsável e participante e adicionar checklist
  continuam iguais.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Workspace sem coluna | `create_action` recusa: "Este workspace não tem coluna". |
| CB-2 | Responsável que não é da empresa | Recusa com o nome do id, nada é criado. |
| CB-3 | Etiqueta de outro workspace | Recusa: "Etiqueta não encontrada neste workspace". |
| CB-4 | Tirar responsável que não estava | Ignora em silêncio. |
| CB-5 | Concluir card já concluído | Responde ok, sem pontos, automação nem histórico repetidos. A data de conclusão é regravada, como no `toggleDone` da tela. |
| CB-6 | Data inválida | Recusa com o campo. |
| CB-7 | Workspace arquivado | Não aparece e não aceita card novo. |

## 6. Decisões de design

### D-1 — Permissão do MCP mais estrita que a tela em mover, etiquetar e pôr pessoas

- **Escolha**: toda escrita num card exige `canEdit`.
- **Por quê**: na tela, o papel `member` só vê os próprios cards, então na prática não mexe nos outros; pelo MCP a IA
  pode chegar a qualquer id. Fechar a tela também seria mudança de comportamento fora deste escopo.

### D-2 — As escritas saem das rotas e viram comandos do domínio

- **Escolha**: `src/features/actions/server/lib/action-commands.ts` com `createWorkspaceAction`,
  `updateWorkspaceAction`, `moveWorkspaceAction`, `setWorkspaceActionDone`, `addActionTag`, `removeActionTag`,
  `addActionResponsible`, `removeActionResponsible`, `addActionParticipant` e `addActionChecklistItem`. As rotas oRPC
  passam a só chamar os comandos. Os comandos lançam `ORPCError` com as mesmas mensagens de hoje.
- **Alternativa descartada**: gravar pelo Prisma no arquivo do MCP. Pularia automações, Stars e avisos, e seriam duas
  versões do mesmo comando para manter.

### D-3 — O Astro continua como está

- O Astro cria card pelo próprio `prisma.action.create`, sem automação nem Stars. Trocar para `createWorkspaceAction` é a
  correção certa, mas muda o comportamento do Astro: vira tarefa separada.

## 7. Dívida e pendências

- Rotas `workspaceWorkflow.get/update/updateIsActive/delete/execute` sem escopo de empresa (achado ao mapear o módulo,
  fora deste PR).
- `action.update` com `columnId` ou `isDone` não dispara automação nem os efeitos de conclusão; a tela usa
  `moveAction`/`toggleDone`, então o efeito real é pequeno. O MCP usa as ferramentas próprias. Não corrigido aqui.

## Changelog

- 2026-11-13 — criada.
- 2026-11-13 — testada de ponta a ponta no banco local pelo `/api/mcp` com chave: CA-1, CA-4 a CA-8 conferidos
  (histórico com o nome da IA, pontos uma vez só, aviso só para quem entrou, `member` sem acesso a card alheio, chave
  antiga sem as ferramentas). CA-2, CA-3 (automação de verdade) e CA-9 (tela) ainda não conferidos.
