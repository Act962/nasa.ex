-- Backfill determinístico da spec 0002 (`specs/form/0002-formularios-com-escopo-de-action.md`).
--
-- NÃO é o backfill heurístico que a decisão D-6 descartou: aqui não há
-- inferência por proximidade temporal. `actions.form_response_id` é uma FK
-- real, então já se sabe exatamente qual resposta gerou qual tarefa. Esta
-- migration só materializa a invariante I1 nas linhas criadas ANTES da
-- feature — as novas já nascem corretas pelo `generateActionsForResponse`.
--
-- Idempotente: `AND action_id IS NULL` e `ON CONFLICT DO NOTHING` (sem alvo,
-- pra absorver QUALQUER índice único, inclusive a PK) tornam a reexecução
-- inofensiva.

-- 1) A resposta que gerou a tarefa passa a PERTENCER a ela.
--
-- `DISTINCT ON` resolve o caso de uma mesma resposta ter gerado mais de uma
-- tarefa (a relação é 1:N): `FormResponses.action_id` comporta só uma, então
-- fica com a primeira gerada — desempate estável por created_at e id.
-- Respostas já vinculadas (avulsas anexadas à mão) não são tocadas.
WITH origem AS (
    SELECT DISTINCT ON (a.form_response_id)
           a.form_response_id,
           a.id AS action_id
    FROM actions a
    WHERE a.form_response_id IS NOT NULL
    ORDER BY a.form_response_id, a.created_at ASC, a.id ASC
)
UPDATE form_responses fr
SET action_id = origem.action_id
FROM origem
WHERE fr.id = origem.form_response_id
  AND fr.action_id IS NULL;

-- 2) O formulário de origem entra na pauta da tarefa, na posição 0.
--
-- Sem isso a tarefa antiga abriria com pauta vazia e dependeria da união
-- defensiva do `action.forms.list`; além disso o `_count.forms` ficaria
-- zerado e o ícone de formulários sumiria do card no kanban.
INSERT INTO action_forms (id, action_id, form_id, "order", created_at)
SELECT
    'af_backfill_' || a.id,
    a.id,
    fr.form_id,
    0,
    CURRENT_TIMESTAMP
FROM actions a
JOIN form_responses fr ON fr.id = a.form_response_id
WHERE a.form_response_id IS NOT NULL
-- Sem alvo de propósito: o id é determinístico (`af_backfill_<actionId>`), então
-- se a tarefa passar a apontar pra uma resposta de OUTRO formulário entre duas
-- execuções, o conflito cai na PK e não no par (action_id, form_id). Declarar
-- o alvo faria a reexecução abortar com `action_forms_pkey`.
ON CONFLICT DO NOTHING;
