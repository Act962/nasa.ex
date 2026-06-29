"use client";

import { Button } from "@/components/ui/button";
import { FlaskConicalIcon } from "lucide-react";
import { useExecuteWorkspaceWorkflow } from "../hooks/use-workspace-workflows";

export const WsExecuteWorkflowButton = ({
  workflowId,
}: {
  workflowId: string;
}) => {
  const execute = useExecuteWorkspaceWorkflow();
  return (
    <Button
      size="lg"
      onClick={() => execute.mutate({ id: workflowId })}
      disabled={execute.isPending}
    >
      <FlaskConicalIcon className="size-4" />
      Executar workflow
    </Button>
  );
};
