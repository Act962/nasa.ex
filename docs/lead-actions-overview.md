# Lead ↔ Actions — Integração de UI (Fase 6)

> Fonte de verdade da integração entre **leads** (pipeline comercial) e **actions/atividades** (execução). Complementa [`workspace-actions-overview.md`](workspace-actions-overview.md), que é canônico para o elo de dados e o isolamento de tenant. Atualize este arquivo ao mexer em qualquer superfície listada abaixo.

## 1. Objetivo

Permitir que o usuário **crie, edite e exclua** atividades vinculadas a um lead e as **visualize bem** onde o lead vive: no card do Kanban do tracking e na lista de contatos. A aba de tarefas dentro do painel do lead fica para uma fase posterior (redesenho — ver `workspace-actions-overview.md` §5, Fase 3.2).

## 2. Modelo (1:N, inalterado)

`Action.leadId` (nullable, `onDelete: SetNull`) → um lead tem N actions; uma action tem 0 ou 1 lead. `Action.trackingId` acompanha e deve casar com `Lead.trackingId` (coerência ainda não imposta — Fase 4). **Sem tabela de junção.** Decisão de manter 1:N registrada; N:N só entra se "evento com múltiplos leads" virar feature — como relação separada, não convertendo `leadId`.

## 3. Dois fluxos reusados

| Fluxo | Namespace | Papel nesta integração |
| --- | --- | --- |
| Lead-scoped | `orpc.leads.*` | **Criar/listar/editar** action de um lead. `createAction` resolve workspace/coluna a partir do tracking do lead e grava `leadId`+`trackingId`. Único caminho que vincula o lead. |
| Workspace | `orpc.action.*` | **Card completo** (`ViewActionModal`) para ver/editar/arquivar/excluir, aberto via search param `?actionId=` (o `ModalProvider` global monta o modal). |

Criar usa o fluxo lead; ver/editar/excluir "completo" usa o modal do fluxo workspace. Não há modal duplicado.

## 4. Autorização (canEdit / canDelete)

Helper novo: [`src/features/actions/server/lib/can-edit-action.ts`](../src/features/actions/server/lib/can-edit-action.ts) → `resolveActionAccess(actionId, { userId, org }, { action? })` devolve `{ canEdit, canDelete, isCreator, isParticipant, ... }`, escopado por `workspace.organizationId` (retorna `null` fora da org → NOT_FOUND).

| Papel | Editar | Excluir |
| --- | --- | --- |
| OWNER / ADMIN / MODERADOR (org) | ✅ | ✅ |
| Dono do workspace (`WorkspaceMember.role = OWNER`) | ✅ | ✅ |
| Criador da action | ✅ | ✅ |
| **Participante** | ✅ | ❌ (op perigosa bloqueada) |
| Outro membro da org | ❌ | ❌ |

Exclusão mantém a trava **"arquivar antes de excluir"** (checagem separada), mesmo para papéis privilegiados.

Adotam o helper: `action.update`, `action.delete` e `leads.updateActionByLead`. Antes, `action.update` não tinha guarda nenhuma de dono/papel (só tenant) e `action.delete` era criador-only + arquivada-only.

## 5. Superfícies de UI

| Superfície | Arquivo | O que faz |
| --- | --- | --- |
| Badge no card do Kanban | [`trackings/components/lead-item.tsx`](../src/features/trackings/components/lead-item.tsx) (`LeadActionsIndicator`) | Ícone `ListTodo` + contagem, azul quando há pendentes. Campo `"actions"` no [`card-visibility.ts`](../src/features/trackings/lib/card-visibility.ts) (ocultável). |
| Popover de atividades | [`leads/components/lead-actions/lead-actions-popover.tsx`](../src/features/leads/components/lead-actions/lead-actions-popover.tsx) | Lista simples (fetch **lazy** ao abrir); cada item abre o card completo via `?actionId=`; botão "+ Adicionar". **Compartilhado** entre Kanban e lista. |
| Modal de criação | [`leads/components/lead-actions/create-lead-action-modal.tsx`](../src/features/leads/components/lead-actions/create-lead-action-modal.tsx) | Título pré-preenchido `Atividade para o lead {nome}`; seletor de workspace só aparece quando o tracking tem >1 (1º pré-selecionado). |
| Lead no card da action | [`actions/components/view-modal/sidebar/linked-lead-field.tsx`](../src/features/actions/components/view-modal/sidebar/linked-lead-field.tsx) | Campo "Lead vinculado" no sidebar do `ViewActionModal`, link para `/contatos/[id]`. `orpc.action.get` já retornava o lead. |
| Coluna na lista de contatos | [`contacts/table-leads/columns.tsx`](../src/features/contacts/table-leads/columns.tsx) | Coluna "Atividades" com o mesmo popover compartilhado. |

**Contagem no payload:** [`app/router/leads/get-many.ts`](../src/app/router/leads/get-many.ts) agrega `actionsSummary { total, pending, done }` (só `isDone` das não-arquivadas), ao lado de `forms`/`nextAppointment`. Tipado em [`trackings/types.ts`](../src/features/trackings/types.ts).

**Invalidação:** o feed do board usa uma queryKey **manual** `["leads.listLeadsByStatus", ...]` — invalidar pela string (não pela key gerada do oRPC) é o que atualiza o badge ao vivo. Aplicado em [`use-lead-action.tsx`](../src/features/leads/hooks/use-lead-action.tsx) (create/update) e no `useDeleteAction` de [`use-tasks.ts`](../src/features/actions/hooks/use-tasks.ts).

## 6. Decisões fechadas

1. Papéis privilegiados incluem **moderador** (consistente com o resto do sistema).
2. Exclusão mantém **arquivar-antes**.
3. Workspace na criação: **1º pré-selecionado**, seletor só quando há >1.
4. Badge: contagem **total + pendente/concluído**.

## 7. Verificação (2026-07-27, runtime)

Feito com `demo@gmail.com` (owner da EMPRESA TESTE), lead "John" no tracking ATENDIMENTO.

- **UI:** badge lê a contagem do payload ("2 atividades — 1 pendente"); popover abre e lista; clicar abre o `ViewActionModal` com "Lead vinculado" → John (`/contatos/...`); "+ Adicionar" pré-preenche "Atividade para o lead John"; seletor de workspace oculto (1 workspace). Criar ponta a ponta grava `leadId`/`trackingId`/`workspaceId` e o badge sobe **ao vivo** 3→4. Coluna "Atividades" na lista abre o mesmo popover.
- **Autorização (fetch autenticado):** update próprio = 200; delete não-arquivado = 403 "Arquive a ação antes"; update/delete/updateByLead cross-org = 404. Matriz `resolveActionAccess` (probe determinístico): participante `canEdit=true/canDelete=false`, criador e admin/moderador ambos true, member aleatório ambos false.

## 8. Changelog

### 2026-07-27 — Fase 6: integração Lead ↔ Actions ✅
Backend: helper `resolveActionAccess` + adoção em `action.update`/`action.delete`/`leads.updateActionByLead`; `actionsSummary` no `get-many`. Frontend: badge + popover compartilhado no Kanban e na lista, modal de criação com título pré-preenchido, campo "Lead vinculado" no card da action. Sem migration. Fora de escopo: aba de tarefas dentro do lead (Fase 3.2), seletor de lead dentro da action (Fase 3.1).
