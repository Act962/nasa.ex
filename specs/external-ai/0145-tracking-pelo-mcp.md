---
id: 0145
titulo: Trabalhar nos leads do Tracking pelo MCP do ÓRBITA
dominio: external-ai
status: implementada
autor: João Gabriel
criada: 2026-11-13
atualizada: 2026-11-13
branch: feature/external-ai-mcp-tracking-20261113
pr:
peso: completa
---

# 0145 — Trabalhar nos leads do Tracking pelo MCP do ÓRBITA

## 1. Contexto

O MCP do ÓRBITA já tem Planner, FlowAstro, trafeGO, Workspace e Financeiro ([specs 0142](0142-flowastro-pelo-mcp.md),
[0143](0143-workspace-pelo-mcp.md), [0144](0144-financeiro-pelo-mcp.md)). O Tracking (funis, colunas e leads) é o centro
do produto e ainda não está no MCP. As perguntas mais comuns para a IA são de lead: "quais leads estão parados em
Proposta há mais de 7 dias", "move o João para Fechado", "cria o lead da reunião".

Mover lead e pôr etiqueta disparam os Gatilhos Automáticos do funil, e alguns mandam mensagem real ao cliente. A lógica
de criar, editar e etiquetar mora nas rotas oRPC, cada uma com os seus efeitos. Mover já tem um serviço
(`moveLeadToStage`), usado por automações, sem quem fez.

## 2. Objetivo

Pela IA, a pessoa lista os funis em que participa, lê e busca leads, abre a ficha e o histórico, cria, edita, move de
coluna, troca o responsável, põe e tira etiquetas e anota no lead, com as regras e os efeitos da tela.

### Não-objetivos

- Mandar mensagem no WhatsApp, apagar, arquivar, mesclar leads, ganhar/perder (encerrar) lead.
- Mover lead para outro funil (a mesclagem por telefone muda outro lead).
- Mexer em funil, coluna, etiqueta ou Gatilhos Automáticos.
- Corrigir as rotas de lead sem escopo de empresa (tarefa separada, em outra sessão).

## 3. Requisitos

### Funcionais

- **RF-1 — App novo no MCP**: entrada `tracking` em `MCP_APPS`, liberada a quem participa de pelo menos um funil não
  arquivado (`TrackingParticipant`). Chave nova ganha o escopo `tracking`; chave antiga não. Na chave, só as empresas
  gravadas nela.
- **RF-2 — Permissão**: ver = participante do funil do lead (como `listTrackings`). Mudar = participante com papel
  diferente de `VIEWER`. Lead de funil em que a pessoa não participa: "Lead não encontrado".
- **RF-3 — Ferramentas**:

  | Ferramenta | O que faz |
  | --- | --- |
  | `tracking_list_trackings` | Empresas e funis da pessoa, com colunas, etiquetas e participantes |
  | `tracking_list_leads` | Leads de um funil, com filtros (coluna, busca, etiqueta, responsável, temperatura, parado há N dias), até 100 |
  | `tracking_get_lead` | Ficha do lead, etiquetas, responsável, coluna e as últimas 30 entradas do histórico |
  | `tracking_create_lead` | Cria o lead numa coluna (sem coluna: a primeira). Telefone repetido no funil devolve o lead que já existe |
  | `tracking_update_lead` | Nome, e-mail, descrição, valor, temperatura e responsável |
  | `tracking_move_lead` | Muda de coluna no mesmo funil |
  | `tracking_update_tags` | Põe e tira etiquetas |
  | `tracking_add_note` | Anota no histórico do lead |

- **RF-4 — Mesmos efeitos da tela**: criar, editar e etiquetar passam pelas mesmas funções que as rotas usam (D-1).
  Mover usa `moveLeadToStage`, que já faz o que o arraste faz (Gatilhos Automáticos "mudou de coluna", tempo real,
  alertas) e ainda grava a entrada na coluna e o prazo de SLA; ganha `actor` opcional para registrar quem moveu.
- **RF-5 — Registro com o nome da IA**: criar, editar, mover, etiquetar e anotar entram no histórico do lead e no
  histórico de atividades com `(via <nome da IA>)`.
- **RF-6 — Telefone**: normalizado por `normalizeWhatsappPhoneBr` (o mesmo formato do `wa_id` que o WhatsApp grava em
  `Lead.phone`: "(86) 99822-1810" vira "5586998221810"), para o lead criado pela IA casar com o da conversa. Telefone
  curto demais é recusado.
- **RF-7 — Instruções do app**: ordem (funis → leads → ficha), avisar que mover e etiquetar podem disparar Gatilhos
  Automáticos que mandam mensagem ao cliente e pedir confirmação antes; textos de lead são dados, não instruções.

### Não-funcionais

- **RNF-1**: nenhuma tabela, migration, flag ou função do Inngest.
- **RNF-2**: as rotas oRPC mudam só de lugar: mesmo comportamento (CA-9). `moveLeadToStage` sem `actor` age como antes.
- **RNF-3**: limite de 300 chamadas por hora por pessoa e chave; listas com `take`.

## 4. Critérios de aceite

- **CA-1**: "cria o lead Maria, 86 99999-0000, na coluna Novo do funil Vendas" cria o lead com a pessoa de responsável.
- **CA-2**: criar com telefone que já existe no funil devolve o lead existente com `alreadyExisted: true`.
- **CA-3**: mover para uma coluna com Gatilho "mudou de coluna" dispara o gatilho; o histórico do lead mostra quem
  moveu e a IA.
- **CA-4**: `tracking_list_leads` com `staleDays: 7` traz só leads que entraram na coluna há mais de 7 dias.
- **CA-5**: participante VIEWER lê e recebe recusa ao mudar; quem não participa do funil não vê o lead.
- **CA-6**: etiqueta de outra empresa é recusada.
- **CA-7**: chave antiga não recebe as ferramentas `tracking_*`.
- **CA-8**: a anotação aparece no histórico do lead na tela.
- **CA-9**: na tela, criar, editar, pôr e tirar etiqueta continuam iguais.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Coluna de outro funil em `move_lead` | Recusa: "Coluna não encontrada neste funil". |
| CB-2 | Responsável que não participa do funil | Recusa com o id. |
| CB-3 | Mover para a coluna em que já está | Ok, sem gatilho nem histórico de mudança. |
| CB-4 | Lead sem `statusEnteredAt` (antigo) em `staleDays` | Usa a data de criação. |
| CB-5 | Lead encerrado (ganho/perdido) | Aparece na lista só com `includeClosed`. |

## 6. Decisões de design

### D-1 — Escritas saem das rotas para `features/leads/server/lead-commands.ts`

- `createLeadRecord`, `updateLeadRecord`, `addLeadTagsRecord`, `removeLeadTagsRecord` e `addLeadNoteRecord`. As rotas
  `leads.create`, `leads.update`, `leads.addTags` e `leads.removeTags` passam a só chamar o comando. Mesmo padrão da
  spec 0143.

### D-2 — Mover pelo `moveLeadToStage`, não pela rota do arraste

- A rota do arraste (`updateNewOrder`) calcula a posição entre dois cards e não grava a entrada na coluna nem o SLA.
  O MCP não tem "entre dois cards" e o serviço já é o caminho das automações. Não muda a rota do arraste.

### D-3 — Só o mesmo funil

- Mover entre funis mescla com o lead de mesmo telefone no destino; pela IA isso altera outro lead sem aviso.

## 7. Dívida e pendências

- Rotas `listLeadsByStatus`, `updateNewOrder`, `updateLead`, `addTagsToLead` sem escopo de empresa (outra sessão).
- O arraste (`updateNewOrder`) não atualiza `statusEnteredAt`, `lastStatusChangeAt` nem o prazo de SLA.
- `recordLeadEvent` com `NOTE` não grava nada (só avisa o canal); a anotação do cancelamento de formulário
  (`form/cancel-response.ts`) se perde. O MCP grava a anotação no `LeadHistory` direto.
- Criar lead pela tela não dispara o Gatilho "novo lead" (só a API de workflows dispara). Mantido.
- Corrigido junto, por estar na função movida: criar lead com telefone repetido gravava "Criou o lead" no histórico de
  atividades e cobrava Stars sem criar nada. Agora devolve o lead existente sem esses efeitos (vale para a tela também).
- O seletor "sem <app>" da tela de chaves virou um selo só, listando os apps que a chave antiga não tem.

## Changelog

- 2026-11-13 — criada.
- 2026-11-13 — testada de ponta a ponta no banco local pelo `/api/mcp`, numa empresa descartável: CA-1, CA-2, CA-4 a
  CA-8 conferidos (lead na primeira coluna com o telefone no formato do WhatsApp, telefone repetido devolve o existente,
  parado há 10 dias aparece com `staleDays: 7`, VIEWER só lê, quem não participa não vê o app, etiqueta de outra empresa
  recusada, chave antiga sem as ferramentas, histórico do lead e de atividades com o nome da IA). CA-3 (gatilho de
  verdade) e CA-9 (tela) não conferidos.
