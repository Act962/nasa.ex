-- FlowAstro (spec 0139, D-13): espera por resposta e espera por tempo são estados diferentes.
CREATE TYPE "WorkflowRunWaitKind" AS ENUM ('INPUT', 'TIME');
ALTER TABLE "workflow_runs" ADD COLUMN "waiting_for" "WorkflowRunWaitKind";
