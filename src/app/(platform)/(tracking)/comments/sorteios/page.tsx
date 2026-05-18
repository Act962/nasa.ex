"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dices,
  Loader2,
  Plus,
  Play,
  Square,
  RefreshCw,
  Trash2,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  useCloseCommentsSorteioCollecting,
  useCommentsSorteios,
  useCreateCommentsSorteio,
  useDeleteCommentsSorteio,
  useDrawCommentsSorteio,
  useResyncCommentsSorteio,
  useStartCommentsSorteioCollecting,
} from "@/features/comments/hooks/use-comments-sorteios";

type Sorteio = {
  id: string;
  title: string;
  status?: string | null;
  prizeName?: string | null;
  winnersCount?: number | null;
  commentsCount?: number | null;
  createdAt?: string | Date | null;
};

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return (typeof d === "string" ? new Date(d) : d).toLocaleString("pt-BR");
}

export default function CommentsSorteiosPage() {
  return (
    <CommentsShell
      title="Sorteios"
      description="Crie sorteios, colete comentários do Instagram e sorteie vencedores."
      actions={<CreateSorteioButton />}
    >
      <CommentsConnectionGuard>
        <SorteiosList />
      </CommentsConnectionGuard>
    </CommentsShell>
  );
}

function CreateSorteioButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const create = useCreateCommentsSorteio();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-3.5" /> Novo sorteio
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo sorteio</DialogTitle>
          <DialogDescription>
            Dê um título para o sorteio. Configure prêmio e regras depois.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Ex: Sorteio de aniversário"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!title.trim()) return;
              create.mutate(
                { title: title.trim() },
                {
                  onSuccess: () => {
                    toast.success("Sorteio criado");
                    setTitle("");
                    setOpen(false);
                  },
                  onError: (err: { message?: string }) =>
                    toast.error(err?.message ?? "Falha ao criar"),
                },
              );
            }}
            disabled={create.isPending || !title.trim()}
          >
            {create.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SorteiosList() {
  const { data, isLoading, isError, error, refetch } = useCommentsSorteios();
  const start = useStartCommentsSorteioCollecting();
  const close = useCloseCommentsSorteioCollecting();
  const resync = useResyncCommentsSorteio();
  const draw = useDrawCommentsSorteio();
  const del = useDeleteCommentsSorteio();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        Carregando sorteios…
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

  const items = (Array.isArray(data) ? data : []) as Sorteio[];

  if (!items.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="size-4" />
            Nenhum sorteio
          </CardTitle>
          <CardDescription>
            Crie o primeiro sorteio para começar a coletar participações.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => {
        const status = (s.status ?? "DRAFT").toString();
        const isCollecting = status === "COLLECTING";
        return (
          <Card key={s.id} className="flex flex-col">
            <CardHeader className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="size-4" />
                  {s.title}
                </CardTitle>
                <Badge variant="outline">{status}</Badge>
              </div>
              <CardDescription className="text-xs">
                {s.prizeName ? `Prêmio: ${s.prizeName} · ` : ""}
                {s.winnersCount ?? 1} ganhador(es)
              </CardDescription>
              <div className="text-xs text-muted-foreground">
                Criado em {formatDate(s.createdAt)}
              </div>
            </CardHeader>
            <CardContent className="mt-auto flex flex-wrap gap-1 pt-2">
              {isCollecting ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    close.mutate(
                      { id: s.id },
                      {
                        onSuccess: () => toast.success("Coleta encerrada"),
                        onError: (err: { message?: string }) =>
                          toast.error(err?.message ?? "Falha"),
                      },
                    )
                  }
                  disabled={close.isPending}
                >
                  <Square className="size-3.5" /> Encerrar
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    start.mutate(
                      { id: s.id },
                      {
                        onSuccess: () => toast.success("Coleta iniciada"),
                        onError: (err: { message?: string }) =>
                          toast.error(err?.message ?? "Falha"),
                      },
                    )
                  }
                  disabled={start.isPending}
                >
                  <Play className="size-3.5" /> Iniciar
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  resync.mutate(
                    { id: s.id },
                    {
                      onSuccess: () => toast.success("Sincronizado"),
                      onError: (err: { message?: string }) =>
                        toast.error(err?.message ?? "Falha"),
                    },
                  )
                }
                disabled={resync.isPending}
              >
                <RefreshCw className="size-3.5" /> Sync
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  draw.mutate(
                    { id: s.id, count: s.winnersCount ?? 1 },
                    {
                      onSuccess: () => toast.success("Sorteio realizado"),
                      onError: (err: { message?: string }) =>
                        toast.error(err?.message ?? "Falha"),
                    },
                  )
                }
                disabled={draw.isPending}
              >
                <Dices className="size-3.5" /> Sortear
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (!confirm(`Excluir sorteio "${s.title}"?`)) return;
                  del.mutate(
                    { id: s.id },
                    {
                      onSuccess: () => toast.success("Sorteio excluído"),
                      onError: (err: { message?: string }) =>
                        toast.error(err?.message ?? "Falha"),
                    },
                  );
                }}
                disabled={del.isPending}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
