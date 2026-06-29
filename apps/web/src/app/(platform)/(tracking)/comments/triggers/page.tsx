"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommentsShell } from "@/features/comments/components/comments-shell";
import { CommentsConnectionGuard } from "@/features/comments/components/connection-guard";
import { useCommentsAutomations } from "@/features/comments/hooks/use-comments-automations";
import { useCreateCommentsTrigger } from "@/features/comments/hooks/use-comments-trigger";

type Automation = { id: string; name: string };
type TriggerType = "DM" | "COMMENT";

export default function CommentsTriggersPage() {
  return (
    <CommentsShell
      title="Gatilhos"
      description="Defina quando uma automação dispara: DMs recebidas ou comentários."
    >
      <CommentsConnectionGuard>
        <TriggerForm />
      </CommentsConnectionGuard>
    </CommentsShell>
  );
}

function TriggerForm() {
  const { data, isLoading } = useCommentsAutomations();
  const create = useCreateCommentsTrigger();

  const automations = (Array.isArray(data) ? data : []) as Automation[];

  const [automationId, setAutomationId] = useState("");
  const [type, setType] = useState<TriggerType>("COMMENT");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        Carregando automações…
      </div>
    );
  }

  if (!automations.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="size-4" />
            Crie uma automação primeiro
          </CardTitle>
          <CardDescription>
            Gatilhos pertencem a automações. Crie uma na aba Automações antes
            de configurar.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Webhook className="size-4" />
          Novo gatilho
        </CardTitle>
        <CardDescription>
          Vincule um tipo de evento (DM ou comentário) a uma automação.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Automação</Label>
          <Select value={automationId} onValueChange={setAutomationId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha uma automação" />
            </SelectTrigger>
            <SelectContent>
              {automations.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Tipo do gatilho</Label>
          <Select value={type} onValueChange={(v) => setType(v as TriggerType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="COMMENT">Comentário em post</SelectItem>
              <SelectItem value="DM">Direct message recebida</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => {
              if (!automationId) {
                toast.error("Selecione uma automação");
                return;
              }
              create.mutate(
                { automationId, type },
                {
                  onSuccess: () => toast.success("Gatilho criado"),
                  onError: (err: { message?: string }) =>
                    toast.error(err?.message ?? "Falha ao criar gatilho"),
                },
              );
            }}
            disabled={create.isPending}
          >
            {create.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Criar gatilho
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
