"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Trash2,
  ExternalLink,
  Copy,
  Loader2,
  FileBarChart2,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ReportsList() {
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["insights", "listSavedReports"],
    queryFn: () => orpc.insights.listSavedReports.call({}),
    refetchOnWindowFocus: false,
  });

  const { mutate: deleteReport, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => orpc.insights.deleteSavedReport.call({ id }),
    onSuccess: () => {
      toast.success("Relatório excluído");
      queryClient.invalidateQueries({ queryKey: ["insights", "listSavedReports"] });
      setConfirmDelete(null);
    },
    onError: (err) => {
      toast.error(`Erro: ${(err as Error).message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  const reports = data?.reports ?? [];

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="size-14 rounded-full bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
          <FileBarChart2 className="size-7 text-violet-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Nenhum relatório salvo ainda</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Vá em <strong>Visão Geral</strong>, configure os filtros e gere um
            relatório por IA. Depois clique em <strong>Salvar relatório</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {reports.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border bg-card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm truncate">{r.name}</h3>
                {r.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {r.description}
                  </p>
                )}
              </div>
              <div className="size-8 shrink-0 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center">
                <FileBarChart2 className="size-4 text-violet-600" />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {Array.isArray(r.modules) &&
                (r.modules as string[]).slice(0, 4).map((m) => (
                  <span
                    key={m}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                  >
                    {m}
                  </span>
                ))}
            </div>

            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>
                {r.author?.name ?? "Anônimo"} ·{" "}
                {formatDistanceToNow(new Date(r.createdAt), { locale: ptBR, addSuffix: true })}
              </span>
            </div>

            <div className="flex items-center gap-1.5 pt-1 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 flex-1"
                onClick={() => {
                  if (r.shareToken) {
                    window.open(`/insights/r/${r.shareToken}`, "_blank");
                  } else {
                    toast.info("Este relatório não tem link público");
                  }
                }}
              >
                <Eye className="size-3.5" /> Ver
              </Button>
              {r.shareToken && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    const url = `${window.location.origin}/insights/r/${r.shareToken}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Link copiado!");
                  }}
                >
                  <Copy className="size-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete({ id: r.id, name: r.name })}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir relatório?</AlertDialogTitle>
            <AlertDialogDescription>
              O relatório "{confirmDelete?.name}" será excluído permanentemente.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteReport(confirmDelete.id)}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="size-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
