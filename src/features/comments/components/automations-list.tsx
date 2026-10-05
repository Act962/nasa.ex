"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Zap } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useCommentsAutomations,
  useCreateCommentsAutomation,
  useDeleteCommentsAutomation,
} from "../hooks/use-comments-automations";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { emitTourResult } from "@/features/tour/store";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";

/** Automações da conta selecionada; `channelId` nulo é organização sem conta conectada. */
export function AutomationsList({ channelId, accountLabel }: { channelId: string | null; accountLabel?: string }) {
  const router = useRouter();
  const canCreate = Boolean(channelId);
  const { data: automations, isLoading: isLoadingAutomations } = useCommentsAutomations(channelId);
  const isLoading = canCreate && isLoadingAutomations;
  const create = useCreateCommentsAutomation();
  const remove = useDeleteCommentsAutomation();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">Automações</CardTitle>
          <CardDescription>
            {accountLabel
              ? `Automações de ${accountLabel}. Cada uma escuta um gatilho e responde por você.`
              : "Cada automação escuta um gatilho e responde por você."}
          </CardDescription>
        </div>
        <Button
          size="sm"
          disabled={!canCreate || create.isPending}
          data-guide={GUIDE_ANCHORS.commentsNewAutomation.id}
          onClick={() =>
            channelId &&
            create.mutate(
              { channelId, name: "Sem título" },
              {
                onSuccess: (created) => {
                  emitTourResult({ kind: GUIDE_RESULT_KINDS.commentAutomationCreated });
                  router.push(`/comments/automations/${created.id}`);
                },
                onError: (error) => toast.error(error.message),
              },
            )
          }
        >
          {create.isPending ? (
            <OrbitaSpinner className="size-4 " />
          ) : (
            <Plus className="size-4" />
          )}
          Nova
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        )}

        {!isLoading && (automations ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            {canCreate
              ? "Nenhuma automação ainda. Crie a primeira."
              : "Conecte uma conta do Instagram para começar."}
          </p>
        )}

        {(automations ?? []).map((automation) => (
          <div
            key={automation.id}
            className="flex items-center justify-between gap-3 rounded-lg border p-3"
          >
            <Link
              href={`/comments/automations/${automation.id}`}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <Zap className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{automation.name}</p>
                <p className="text-xs text-muted-foreground">
                  {automation.sentCount} envio(s) · {automation.triggerCount}{" "}
                  gatilho(s)
                </p>
              </div>
            </Link>

            <Badge variant={automation.isActive ? "default" : "secondary"}>
              {automation.isActive ? "Ativa" : "Pausada"}
            </Badge>

            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                remove.mutate(
                  { id: automation.id },
                  {
                    onSuccess: () => toast.success("Automação excluída"),
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
