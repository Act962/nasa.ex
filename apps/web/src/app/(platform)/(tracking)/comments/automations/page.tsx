"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CommentsShell } from "@/features/comments/components/comments-shell";
import { CommentsConnectionGuard } from "@/features/comments/components/connection-guard";
import {
  useCommentsAutomations,
  useCreateCommentsAutomation,
  useDeleteCommentsAutomation,
  useUpdateCommentsAutomationActive,
} from "@/features/comments/hooks/use-comments-automations";

type Automation = {
  id: string;
  name: string;
  active?: boolean | null;
  createdAt?: string | Date | null;
};

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return (typeof d === "string" ? new Date(d) : d).toLocaleString("pt-BR");
}

export default function CommentsAutomationsPage() {
  return (
    <CommentsShell
      title="Automações"
      description="Crie fluxos de resposta automática para DMs e comentários."
      actions={<CreateAutomationButton />}
    >
      <CommentsConnectionGuard>
        <AutomationsList />
      </CommentsConnectionGuard>
    </CommentsShell>
  );
}

function CreateAutomationButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const create = useCreateCommentsAutomation();

  const submit = () => {
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim() },
      {
        onSuccess: () => {
          toast.success("Automação criada");
          setName("");
          setOpen(false);
        },
        onError: (err: { message?: string }) =>
          toast.error(err?.message ?? "Falha ao criar automação"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-3.5" /> Nova automação
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova automação</DialogTitle>
          <DialogDescription>
            Dê um nome para identificar essa automação.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Ex: Resposta para sorteios"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={create.isPending || !name.trim()}>
            {create.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AutomationsList() {
  const { data, isLoading, isError, error, refetch } = useCommentsAutomations();
  const toggle = useUpdateCommentsAutomationActive();
  const del = useDeleteCommentsAutomation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        Carregando automações…
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Erro ao carregar</CardTitle>
          <CardDescription className="text-destructive">
            {error instanceof Error ? error.message : "Erro desconhecido"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const items = (Array.isArray(data) ? data : []) as Automation[];

  if (!items.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-4" />
            Nenhuma automação ainda
          </CardTitle>
          <CardDescription>
            Crie a primeira automação para começar a responder DMs e
            comentários automaticamente.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((a) => (
        <Card key={a.id} className="flex flex-col">
          <CardHeader className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="size-4" />
                {a.name}
              </CardTitle>
              <Badge variant={a.active ? "default" : "secondary"}>
                {a.active ? "Ativa" : "Inativa"}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Criada em {formatDate(a.createdAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto flex items-center justify-between gap-2 pt-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={!!a.active}
                onCheckedChange={(checked) =>
                  toggle.mutate(
                    { id: a.id, active: checked },
                    {
                      onError: (err: { message?: string }) =>
                        toast.error(err?.message ?? "Falha ao atualizar"),
                    },
                  )
                }
                disabled={toggle.isPending}
              />
              <span className="text-xs text-muted-foreground">Ativar</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!confirm(`Excluir automação "${a.name}"?`)) return;
                del.mutate(
                  { id: a.id },
                  {
                    onSuccess: () => toast.success("Automação excluída"),
                    onError: (err: { message?: string }) =>
                      toast.error(err?.message ?? "Falha ao excluir"),
                  },
                );
              }}
              disabled={del.isPending}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
