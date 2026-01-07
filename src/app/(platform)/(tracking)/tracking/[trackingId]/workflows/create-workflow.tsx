"use client";

import { Button } from "@/components/ui/button";
import { useCreateWorkflow } from "@/features/workflows/hooks/use-workflows";
import { useParams } from "next/navigation";

export function CreateWorkflowButton() {
  const { trackingId } = useParams<{ trackingId: string }>();
  const createWorkflow = useCreateWorkflow();

  const onCreate = () =>
    createWorkflow.mutate({
      name: "Sem título",
      trackingId,
    });

  return <Button onClick={onCreate}>Adicionar Automação</Button>;
}
