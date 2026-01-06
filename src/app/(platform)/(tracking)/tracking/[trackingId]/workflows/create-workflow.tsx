"use client";

import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export function CreateWorkflowButton() {
  const { trackingId } = useParams<{ trackingId: string }>();
  const queryClient = useQueryClient();
  const mutation = useMutation(
    orpc.workflow.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.workflow.list.queryKey({
            input: {
              trackingId,
            },
          }),
        });
      },
    })
  );

  const onCreate = () => {
    mutation.mutate({
      name: "Sem título",
      trackingId,
    });
  };

  return <Button onClick={onCreate}>Adicionar Automação</Button>;
}
