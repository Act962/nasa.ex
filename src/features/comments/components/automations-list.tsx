"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Zap } from "lucide-react";
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

export function AutomationsList({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const { data: automations, isLoading } = useCommentsAutomations();
  const create = useCreateCommentsAutomation();
  const remove = useDeleteCommentsAutomation();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">Automações</CardTitle>
          <CardDescription>
            Cada automação escuta um gatilho e responde por você.
          </CardDescription>
        </div>
        <Button
          size="sm"
          disabled={!canCreate || create.isPending}
          onClick={() =>
            create.mutate(
              { name: "Sem título" },
              {
                onSuccess: (created) =>
                  router.push(`/comments/automations/${created.id}`),
                onError: (error) => toast.error(error.message),
              },
            )
          }
        >
          {create.isPending ? (
            <Loader2 className="size-4 animate-spin" />
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
