-- Backfill do vínculo Action -> Tracking (Fase 2 de docs/workspace-actions-overview.md).
--
-- Migration de DADOS, não de schema: `actions.tracking_id` já existe desde
-- 20251205211731_update_action. Até a Fase 2 nenhum caminho de criação
-- preenchia a coluna, então toda action herda agora o tracking do workspace
-- onde vive.
--
-- Só toca linhas com `tracking_id` nulo. Actions que já tenham um tracking
-- gravado (via os poucos escritores legados) ficam intactas, e workspaces sem
-- vínculo continuam produzindo NULL.

UPDATE "actions"
SET "tracking_id" = "workspaces"."tracking_id"
FROM "workspaces"
WHERE "actions"."workspace_id" = "workspaces"."id"
  AND "actions"."tracking_id" IS NULL
  AND "workspaces"."tracking_id" IS NOT NULL;
