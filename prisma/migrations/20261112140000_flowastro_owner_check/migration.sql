-- FlowAstro (spec 0139, D-11): o fluxo pertence a exatamente um dono — funil, workspace ou empresa.
ALTER TABLE "workflows" DROP CONSTRAINT "workflows_owner_xor";
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_owner_xor"
  CHECK (
    (CASE WHEN "tracking_id" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "workspace_id" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "organization_id" IS NULL THEN 0 ELSE 1 END) = 1
  );
