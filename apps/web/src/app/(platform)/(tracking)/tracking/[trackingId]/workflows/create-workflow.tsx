"use client";

import { Button } from "@/components/ui/button";
import { useCreateWorkflow } from "@/features/workflows/hooks/use-workflows";
import { PlusIcon } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

interface CreateWorkflowButtonProps {
  /** Se passado, novo workflow já é criado dentro dessa pasta. */
  folderId?: string | null;
  /** Customiza o label do botão (ex: "+ Automação" dentro de uma pasta). */
  label?: string;
  /** Tamanho do botão (default "sm"). */
  size?: "sm" | "default" | "lg";
  /** Variante do botão. */
  variant?: "default" | "outline" | "ghost";
}

export function CreateWorkflowButton({
  folderId,
  label,
  size = "sm",
  variant = "default",
}: CreateWorkflowButtonProps = {}) {
  const router = useRouter();
  const { trackingId } = useParams<{ trackingId: string }>();
  const createWorkflow = useCreateWorkflow();

  const onCreate = () =>
    createWorkflow.mutate(
      {
        name: "Sem título",
        trackingId,
        folderId: folderId ?? null,
      },
      {
        onSuccess: (data) => {
          router.push(`/tracking/${trackingId}/workflows/${data.id}`);
        },
      },
    );

  return (
    <Button onClick={onCreate} size={size} variant={variant}>
      <PlusIcon className="size-4" />
      <span className="hidden sm:inline">
        {label ?? "Adicionar Automação"}
      </span>
    </Button>
  );
}
