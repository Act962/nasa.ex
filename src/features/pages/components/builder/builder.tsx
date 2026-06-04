"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc, client } from "@/lib/orpc";
import { toast } from "sonner";
import { usePage } from "../../hooks/use-pages";
import { usePagesBuilderStore } from "../../context/pages-builder-store";
import { BuilderTopbar } from "./builder-topbar";
import { BuilderSidebar } from "./builder-sidebar";
// Animações disponíveis no editor (preview de sections + previews
// dos blocos interativos como marquee/counter).
import "../../lib/animations.css";
import { BuilderCanvas } from "./builder-canvas";
import type { PageLayout } from "../../types";

interface Props {
  pageId: string;
}

// Status do autosave — exibido no topbar pra o user ter feedback.
export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 600;

export function PagesBuilder({ pageId }: Props) {
  const qc = useQueryClient();
  const { data, isLoading } = usePage(pageId);
  const setPage = usePagesBuilderStore((s) => s.setPage);
  const layout = usePagesBuilderStore((s) => s.layout);

  // Estado do autosave (idle/dirty/saving/saved/error)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  // Ref do timeout de debounce — precisamos cancelar manualmente em
  // saveNow() e em unmount pra evitar saves stale.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref do layout mais recente — `saveNow` lê daqui pra não depender
  // de closures stale.
  const layoutRef = useRef<PageLayout | null>(null);
  // Flag indicando se há mudança ainda não persistida no servidor.
  // Setada a cada mutação do layout, zerada quando o save retorna.
  const dirtyRef = useRef(false);
  // Marca o layout que entrou via setPage (carregamento inicial). NÃO
  // queremos disparar autosave nessa primeira mudança — só nas
  // subsequentes feitas pelo user.
  const skipNextAutosaveRef = useRef(true);

  useEffect(() => {
    if (data?.page) {
      skipNextAutosaveRef.current = true;
      setPage(pageId, data.page.layout as unknown as PageLayout);
    }
  }, [data?.page, pageId, setPage]);

  const saveMutation = useMutation({
    mutationFn: (lay: PageLayout) =>
      client.pages.updatePage({ id: pageId, layout: lay }),
    onMutate: () => setSaveStatus("saving"),
    onSuccess: () => {
      dirtyRef.current = false;
      setSaveStatus("saved");
    },
    onError: () => {
      setSaveStatus("error");
      toast.error("Falha ao salvar");
    },
  });
  const saveMutateAsync = saveMutation.mutateAsync;

  // Salva IMEDIATAMENTE o layout atual e aguarda concluir. Cancela
  // qualquer debounce pendente. Usado por publish / voltar / preview.
  const saveNow = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const lay = layoutRef.current;
    if (!lay || !dirtyRef.current) return;
    await saveMutateAsync(lay);
  }, [saveMutateAsync]);

  // Autosave debounced — dispara a cada mudança de layout.
  useEffect(() => {
    layoutRef.current = layout;
    if (!layout) return;
    if (skipNextAutosaveRef.current) {
      // Primeiro layout (carregado do servidor) — não persistir.
      skipNextAutosaveRef.current = false;
      return;
    }
    dirtyRef.current = true;
    setSaveStatus("dirty");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveMutation.mutate(layout);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // saveMutation é estável (useMutation hook); só re-rodar quando
    // layout muda. ESLint warn ignorada de propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // Avisa o user se ele tentar fechar/recarregar com mudanças
  // pendentes (race com refresh = perda de dados).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Após "Salvo" persistir 2s, volta pra "idle" — UI não fica com
  // checkmark verde pra sempre quando o user para de editar.
  useEffect(() => {
    if (saveStatus !== "saved") return;
    const handle = setTimeout(() => setSaveStatus("idle"), 2000);
    return () => clearTimeout(handle);
  }, [saveStatus]);

  const { mutateAsync: publishMutateAsync, isPending: publishing } =
    useMutation({
      mutationFn: () => client.pages.publishPage({ id: pageId }),
      onSuccess: () => {
        toast.success("Publicado com sucesso");
        qc.invalidateQueries({
          queryKey: orpc.pages.getPage.queryKey({ input: { id: pageId } }),
        });
        qc.invalidateQueries({ queryKey: orpc.pages.listPages.queryKey() });
      },
    });

  // Antes de publicar: flush autosave. Senão o server lê o layout
  // VELHO do banco e publica sem as últimas edições.
  const handlePublish = useCallback(async () => {
    try {
      await saveNow();
      await publishMutateAsync();
    } catch {
      toast.error("Falha ao publicar — tente novamente");
    }
  }, [saveNow, publishMutateAsync]);

  const page = useMemo(() => data?.page ?? null, [data?.page]);

  if (isLoading || !layout || !page) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center text-sm text-muted-foreground">
        Carregando editor…
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-muted/20">
      <BuilderTopbar
        page={page}
        onPublish={handlePublish}
        publishing={publishing}
        saveStatus={saveStatus}
        flushSave={saveNow}
      />
      <div className="flex-1 flex min-h-0">
        <BuilderSidebar />
        <BuilderCanvas />
      </div>
    </div>
  );
}
