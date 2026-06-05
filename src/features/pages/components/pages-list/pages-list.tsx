"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc, client } from "@/lib/orpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Plus,
  Globe,
  Pencil,
  ExternalLink,
  Sparkles,
  LayoutTemplate,
  Trash2,
  Loader2,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { usePages, usePagesCost } from "../../hooks/use-pages";
import { CreatePageWizard } from "../wizard/create-page-wizard";
import { INTENT_LABELS } from "../../constants";

export function PagesList() {
  const [wizardOpen, setWizardOpen] = useState(false);
  // Page selecionada pra exclusão. null = dialog fechado.
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
    isPublished: boolean;
  } | null>(null);
  const { data, isLoading } = usePages();
  const { data: cost } = usePagesCost();
  const qc = useQueryClient();

  const { mutate: deletePage, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => client.pages.deletePage({ id }),
    onSuccess: () => {
      toast.success("Rascunho apagado");
      qc.invalidateQueries({ queryKey: orpc.pages.listPages.queryKey() });
      setDeleteTarget(null);
    },
    onError: (e: Error) => {
      toast.error(e.message ?? "Erro ao apagar");
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="size-6 text-indigo-500" />
            NASA Pages
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Construa sites e landing pages integradas ao ecossistema NASA.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {cost ? (
            <Badge variant="outline" className="text-xs gap-1 py-1">
              <span className="text-yellow-500">★</span>
              {cost.stars.toLocaleString("pt-BR")} / site
            </Badge>
          ) : null}
          <Button asChild variant="outline" className="gap-2">
            <Link href="/pages/templates">
              <LayoutTemplate className="size-4" />
              Templates
            </Link>
          </Button>
          <Button onClick={() => setWizardOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Novo site
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : !data?.pages?.length ? (
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
            <Sparkles className="size-8 text-muted-foreground" />
            <p className="font-medium">Nenhum site ainda</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Crie seu primeiro site NASA Pages por {cost?.stars ?? 2000} Stars. Você pode ter
              quantos sites quiser por organização.
            </p>
            <Button onClick={() => setWizardOpen(true)} className="mt-2 gap-2">
              <Plus className="size-4" />
              Começar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.pages.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <CardContent className="p-5 flex-1 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{p.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">/{p.slug}</p>
                  </div>
                  <Badge variant={p.status === "PUBLISHED" ? "default" : "secondary"}>
                    {p.status === "PUBLISHED" ? "Publicado" : "Rascunho"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {p.description ?? INTENT_LABELS[p.intent]}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {p.layerCount === 2 ? "2 camadas (parallax)" : "1 camada"}
                  </span>
                  {p.customDomain ? (
                    <span className="flex items-center gap-1">
                      <Globe className="size-3" />
                      {p.customDomain}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 mt-auto pt-3 border-t">
                  <Button asChild size="sm" variant="outline" className="gap-1">
                    <Link href={`/pages/${p.id}`}>
                      <Pencil className="size-3.5" />
                      Editar
                    </Link>
                  </Button>
                  {p.status === "PUBLISHED" && (
                    <Button asChild size="sm" variant="ghost" className="gap-1">
                      <a href={`/s/${p.slug}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-3.5" />
                        Ver
                      </a>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="ghost" className="gap-1" title="Analytics">
                    <Link href={`/pages/${p.id}/analytics`}>
                      <BarChart3 className="size-3.5" />
                    </Link>
                  </Button>
                  {/* Botão de excluir — disponível pra rascunho OU
                      publicado. Confirmação extra pra publicado
                      no dialog (texto + tag). */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 ml-auto text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() =>
                      setDeleteTarget({
                        id: p.id,
                        title: p.title,
                        isPublished: p.status === "PUBLISHED",
                      })
                    }
                    title="Apagar"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreatePageWizard open={wizardOpen} onOpenChange={setWizardOpen} />

      {/* Dialog de confirmação de exclusão.
          Pra page publicada, alerta mais forte (cor + texto explícito).
          Logactivity é registrada server-side em delete-page.ts. */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.isPublished
                ? "Apagar page publicada?"
                : "Apagar rascunho?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.isPublished ? (
                <>
                  Você vai apagar <strong>"{deleteTarget?.title}"</strong>{" "}
                  permanentemente.{" "}
                  <strong className="text-destructive">
                    Esta página está publicada
                  </strong>{" "}
                  — o link público vai parar de funcionar imediatamente.
                  Visitantes vão receber 404.
                </>
              ) : (
                <>
                  Você vai apagar o rascunho{" "}
                  <strong>"{deleteTarget?.title}"</strong> permanentemente.
                  Como ele nunca foi publicado, nada além das suas
                  edições será perdido.
                </>
              )}
              <br />
              <br />
              <span className="text-xs">
                Esta ação é irreversível e fica registrada em Insights →
                Atividade.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deletePage(deleteTarget.id);
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-3.5 mr-2 animate-spin" />
                  Apagando…
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5 mr-2" />
                  Apagar definitivamente
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
