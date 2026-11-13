---
id: 0142
titulo: Criar e editar fluxos do FlowAstro pelo MCP do ÓRBITA
dominio: workflows
status: implementada
autor: João Gabriel
criada: 2026-11-13
atualizada: 2026-11-13
branch: claude/fluxo-atendimento-creator-ac11e1
pr:
peso: completa
---

# 0142 — Criar e editar fluxos do FlowAstro pelo MCP do ÓRBITA

## 1. Contexto

Montar um fluxo do FlowAstro ([spec 0139](0139-fluxo-de-atendimento.md)) é arrastar blocos, ligar saídas e preencher cada
painel. Um fluxo como o da promoção ([spec 0140](0140-blocos-promocao-star-friends.md)) tem 15 blocos e 36 ligações. A
empresa já conecta a própria IA (ChatGPT, claude.ai, Claude Code) ao MCP do ÓRBITA ([specs 0065](../nasa-planner/0065-mcp-e-caixa-de-criacoes.md),
[0135](../external-ai/0135-mcp-conectar-pelo-chatgpt-oauth.md)) para o Planner. O pedido: a mesma IA monta, revisa e liga
o fluxo inteiro a partir de uma conversa ("cria um atendimento da pizzaria com cardápio, pedido e atendente"), sem abrir o
editor.

O MCP é sem estado e registra as ferramentas por app (`MCP_APPS`, D-7 da 0135): app novo é um arquivo de ferramentas e uma
entrada no registro. Quem chama é uma pessoa, por chave `orb_live_` ou OAuth, e cada ferramenta vale pelas permissões dela.

## 2. Objetivo

Pelo MCP, a IA da pessoa lista os números, cria um fluxo, monta todos os blocos e ligações, escolhe os números, liga e
desliga o fluxo, com as mesmas regras e travas do editor.

### Não-objetivos

- Apagar fluxo pelo MCP. Apagar tira os leads de dentro e não tem volta; fica na tela.
- Ver ou mexer nos leads dentro de um fluxo (tirar do fluxo, mover de bloco).
- Criar campanha do STAR FRIENDS, menu salvo, formulário ou agenda: os blocos só apontam para o que já existe.
- Editar o mesmo fluxo ao mesmo tempo que alguém no editor (D-4 trata o conflito, não junta as duas edições).

## 3. Requisitos

### Funcionais

- **RF-1 — App novo no MCP**: entrada `flowastro` em `MCP_APPS`, liberada a quem tem a permissão de Automações do
  Tracking (`checkOrganizationAttendanceAccess`, a mesma da tela) em pelo menos uma empresa. Por OAuth vale sozinho; chave
  nova ganha o escopo `flowastro`. Chave antiga não ganha nada sem ser recriada. Na chave, valem as empresas escolhidas
  na criação dela (a lista da tela é a do Planner): empresa só com Tracking, sem Planner, precisa do OAuth.
- **RF-2 — Empresas**: toda ferramenta recebe `organizationId` (ou um id de fluxo, de onde a empresa sai) e confere a
  permissão da pessoa naquela empresa: `canView` para ler, `canEdit` para criar e mudar. Na chave, só as empresas gravadas
  nela.
- **RF-3 — Ferramentas**:

  | Ferramenta | O que faz | Permissão |
  | --- | --- | --- |
  | `flowastro_list_numbers` | Empresas e números de WhatsApp em que a pessoa pode montar fluxo, com o funil e as colunas de cada número | `canView` |
  | `flowastro_get_block_catalog` | Cada tipo de bloco: o que faz, o formato do `data` com exemplo, as saídas e as variáveis que grava. Mais as regras de entrada e as variáveis do contato | — |
  | `flowastro_list_flows` | Fluxos da empresa: nome, entrada, números, ligado, leads dentro, `version` | `canView` |
  | `flowastro_get_flow` | O fluxo no formato da IA (RF-4), com `version` e os avisos (RF-6) | `canView` |
  | `flowastro_create_flow` | Cria desligado, em branco, por modelo (`FLOW_TEMPLATES`) ou já com os blocos (RF-4) | `canEdit` |
  | `flowastro_update_flow` | Troca o desenho inteiro pelo enviado (RF-4); pede a `version` lida (D-4) | `canEdit` |
  | `flowastro_rename_flow` | Muda o nome | `canEdit` |
  | `flowastro_set_numbers` | Escolhe os números em que o fluxo responde | `canEdit` |
  | `flowastro_set_active` | Liga ou desliga | `canEdit` |

- **RF-4 — Formato da IA**: o fluxo vai e volta como uma lista de blocos, sem posição nem id técnico:
  `{ id: "boas_vindas", type: "message", data: {...}, next: { "main": "pergunta_nome", "btn:promo": "inscricao" } }`.
  - `id` é um apelido escolhido pela IA (letras, números e `_`), único no fluxo; o servidor gera os ids reais e os mantém
    entre uma edição e outra (a `get_flow` devolve os apelidos que guardou).
  - `type` é a chave do catálogo (`start`, `message`, `question`, `condition`, `aiAgent`...), não o `NodeType`.
  - `next` liga cada saída a um bloco. As saídas válidas são as do catálogo para aquele `data` (`attendanceNodeOutputs`):
    botão `btn:<id do botão>`, "Próximo passo" `no_click`, Pergunta `answered`/`invalid` e assim por diante.
  - O servidor posiciona os blocos sozinho, com o mesmo organizador do botão "Organizar" do editor. Se a IA só mudou
    conteúdo (nenhum bloco novo), os blocos ficam onde estavam.
- **RF-5 — Mesmas regras do editor**: criar e atualizar passam pelo mesmo salvamento do editor
  (`workflow.update.updateNodes`, extraído para uma função do domínio): checagem de laço, conflito de entrada com outro
  fluxo ligado, conferência das capacidades do Agente de IA e saída dos leads que esperavam num bloco apagado. Ligar passa
  pela mesma trava do botão (`findAttendanceEntryConflict` e texto de exemplo).
- **RF-6 — Avisos para a IA corrigir**: criar, atualizar e ler devolvem `warnings` em linguagem simples, sem impedir o
  salvamento: bloco com campo obrigatório vazio (o mesmo do cartão: "Escolha o áudio", "Digite sua pergunta"), saída que
  não existe naquele bloco, ligação para um apelido que não existe, bloco que ninguém alcança, fluxo sem número, fluxo sem
  bloco inicial. Erro de verdade (laço, mais de um bloco inicial, tipo desconhecido) recusa com a mensagem.
- **RF-7 — Registro**: cada criação, edição, troca de números e liga/desliga entra no histórico de atividades da empresa
  com o nome da IA (`caller.label`), como no Planner.
- **RF-8 — Instruções do app**: o texto do app no MCP ensina a ordem (catálogo → números → criar → revisar avisos →
  números → mostrar o desenho ao usuário → ligar só com a confirmação dele) e lembra que ligar faz o fluxo responder
  clientes de verdade.

### Não-funcionais

- **RNF-1**: nenhuma tabela, migration, flag ou função do Inngest. Os apelidos ficam no `data` de cada bloco
  (`data.mcpId`), que o editor ignora.
- **RNF-2**: o salvamento do editor muda só de lugar: mesmo comportamento, coberto por CA-9.
- **RNF-3**: até 200 blocos por fluxo pelo MCP (o desenho maior que existe hoje tem 25).

## 4. Critérios de aceite

- **CA-1**: pelo Claude Code com chave nova, pedir "crie um fluxo de boas-vindas com menu de 3 opções" cria um fluxo
  desligado que abre no editor organizado, com as ligações certas.
- **CA-2**: `get_flow` de um fluxo feito no editor devolve os blocos no formato da IA; mandar o mesmo conteúdo de volta
  em `update_flow` não muda nada no editor.
- **CA-3**: `update_flow` com a `version` antiga (alguém salvou depois) é recusado com "O fluxo mudou desde a leitura".
- **CA-4**: pessoa sem permissão de editar Automações na empresa recebe recusa em criar, atualizar, números e ligar.
- **CA-5**: `set_active` com conflito de entrada devolve a mesma mensagem do editor e o fluxo fica desligado.
- **CA-6**: bloco "message" sem texto volta em `warnings` como "Insira o seu texto", e o fluxo é salvo.
- **CA-7**: ligação `next` para saída que o bloco não tem volta em `warnings` e não é gravada.
- **CA-8**: a criação aparece no histórico de atividades com o nome da IA.
- **CA-9**: o editor continua salvando como antes (organizar, apagar bloco com lead esperando, conflito de entrada).

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | A IA manda dois blocos `start` | Recusa: "O fluxo tem um bloco inicial só". |
| CB-2 | Fluxo sem `start` | Cria com um bloco inicial e avisa; nada se liga a ele sozinho. |
| CB-3 | Apelido repetido | Recusa, dizendo qual. |
| CB-4 | `update_flow` enquanto alguém edita na tela | O primeiro que salvar ganha; o outro recebe "O fluxo mudou" (MCP) ou tem o salvamento automático sobrescrevendo (tela, D-4). |
| CB-5 | Bloco aponta para menu salvo, formulário, agenda ou campanha de outra empresa | O salvamento já descarta ids de outra empresa no Agente de IA; nos outros blocos o executor não acha e o passo falha. Vai em `warnings`. |
| CB-6 | Fluxo ligado e a IA apaga o bloco em que um lead espera | O lead sai do fluxo (mesma regra do editor). |
| CB-7 | `set_numbers` em fluxo ligado com conflito | Recusa com a mensagem do conflito (já existe em `setNumbers`). |
| CB-8 | Chave sem a empresa | Recusa como empresa não encontrada, sem dizer se ela existe. |

## 6. Decisões de design

### D-1 — Formato próprio para a IA, convertido no servidor

- **Escolha**: apelidos, tipo do catálogo e `next` por saída; o servidor gera ids, posições e ligações.
- **Alternativa descartada**: expor `nodes`/`edges` do React Flow. A IA teria de inventar posição, handle e id, e erraria
  a convenção das saídas (`source-1`, `main`, `btn:`).

### D-2 — `data` de cada bloco é o mesmo do editor

- **Escolha**: o catálogo mostra o `data` real de cada tipo, com o exemplo do `defaultData` e a descrição de cada campo.
- **Alternativa descartada**: um formato simplificado por bloco, convertido para o do editor. Seriam 15 conversores para
  manter em dia com o editor; qualquer campo novo no painel ficaria fora do MCP até alguém lembrar.

### D-3 — O salvamento sai do procedimento e vira função do domínio

- **Escolha**: `saveWorkflowGraph` em `features/workflows/server/save-workflow-graph.ts`, chamada por
  `workflow.update.updateNodes` (todos os fluxos, como antes) e pelas ferramentas. Criar e escolher números saíram do
  roteador para `features/attendance-flows/server/flow-commands.ts`, usado pela tela e pelo MCP. Ligar pelo MCP usa
  `setAttendanceFlowActive` (disputa de entrada, texto de exemplo, desligar tira os leads); o botão da tela segue no
  procedimento de sempre, que também trata as automações antigas.
- **Por quê**: as travas do editor (laço, conflito de entrada, capacidades da IA, bloco apagado) têm de valer igual pelo
  MCP. Duas cópias divergiriam na primeira mudança.

### D-4 — `version` contra sobrescrita

- **Escolha**: `version` é o `updatedAt` do fluxo. `update_flow` recusa se mudou desde a leitura.
- **Por quê**: a IA lê, pensa e manda o desenho inteiro minutos depois; sem a conferência, apagaria o que alguém fez na
  tela nesse meio. O editor continua sem conferência (salvamento automático), como hoje.

### D-5 — Ligar só com confirmação do usuário

- **Escolha**: a ferramenta liga direto, mas as instruções do app exigem mostrar o desenho e os números e esperar o "pode
  ligar" do usuário, como o `publish_now` do Planner.
- **Por quê**: um fluxo ligado responde clientes reais no mesmo minuto.

## 7. Impacto

- **Banco**: nada novo. `Node.data` ganha `mcpId` opcional.
- **Arquivos**: `features/external-ai/server/mcp/apps.ts` (entrada nova), `.../mcp/flowastro-mcp-tools.ts` (novo),
  `features/workflows/server/save-workflow-graph.ts` (novo, extraído de `app/router/workflow/update.ts`),
  `features/attendance-flows/server/flow-commands.ts` (novo, extraído de `app/router/attendance-flow/index.ts`),
  `features/attendance-flows/lib/mcp-format.ts` (novo: catálogo, conversão e avisos), `external-ai/server/access-tokens.ts`
  (escopo novo na chave), tela "IA externa" (texto e selo "sem FlowAstro" nas chaves antigas).
- **Inngest**: nada.
- **Docs**: `docs/` do MCP, se houver tabela de ferramentas.

## 8. Plano de testes

- Pelo Claude Code com chave local: CA-1 a CA-8, criando um fluxo do zero, editando, quebrando de propósito (saída
  inválida, campo vazio, versão antiga) e ligando com e sem conflito.
- No editor: CA-9 (organizar, apagar bloco, conflito de entrada) depois da extração.
- Conversão ida e volta (CA-2) com os fluxos "Teste completo (WhatsApp)" e "Promoção com cupom".

## 9. Riscos e rollback

- **IA monta fluxo ruim e liga**: mitigado por D-5 e pelos avisos; o fluxo nasce desligado.
- **Extração do salvamento quebrar o editor**: CA-9; a função é a mesma, só muda de arquivo.
- **Rollback**: tirar a entrada `flowastro` de `MCP_APPS` desliga tudo pelo MCP sem tocar no editor.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-11-13 | João Gabriel | Criada. |
| 2026-11-13 | João Gabriel | Implementada. Testado em local pelo MCP com chave: CA-1, CA-2, CA-3, CA-5, CA-6, CA-7, CA-8 e CA-9 (organizar no editor salva pela função nova). CA-4 (pessoa sem permissão) não testado: falta um segundo usuário local. Fluxo de teste "Pizzaria (teste MCP)" ficou desligado na empresa CLAUDE. |
| 2026-11-13 | João Gabriel | Revisão de código: "Conexão de fluxo" confere a empresa também de fluxo sem funil; criar com blocos apaga o fluxo se o desenho falhar; apelido repetido (bloco duplicado no editor) cai no id real; id só é reaproveitado no mesmo tipo de bloco; versão inválida tem mensagem própria; checagem de empresa olha só a empresa pedida; ligar pela tela e pelo MCP é a mesma função (`setAttendanceFlowActive`), que recusa menu salvo; etiquetas com limite por empresa. |
