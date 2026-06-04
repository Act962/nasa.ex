"use client";

import { useEffect, useMemo } from "react";
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

export function PagesBuilder({ pageId }: Props) {
  const qc = useQueryClient();
  const { data, isLoading } = usePage(pageId);
  const setPage = usePagesBuilderStore((s) => s.setPage);
  const layout = usePagesBuilderStore((s) => s.layout);

  useEffect(() => {
    if (data?.page) {
      setPage(pageId, data.page.layout as unknown as PageLayout);
    }
  }, [data?.page, pageId, setPage]);

  const { mutate: saveLayout } = useMutation({
    mutationFn: (lay: PageLayout) =>
      client.pages.updatePage({ id: pageId, layout: lay }),
    onError: () => toast.error("Falha ao salvar"),
  });

  useEffect(() => {
    if (!layout) return;
    const handle = setTimeout(() => saveLayout(layout), 600);
    return () => clearTimeout(handle);
  }, [layout, saveLayout]);

  const { mutate: publish, isPending: publishing } = useMutation({
    mutationFn: () => client.pages.publishPage({ id: pageId }),
    onSuccess: () => {
      toast.success("Publicado com sucesso");
      qc.invalidateQueries({ queryKey: orpc.pages.getPage.queryKey({ input: { id: pageId } }) });
      qc.invalidateQueries({ queryKey: orpc.pages.listPages.queryKey() });
    },
  });

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
        onPublish={() => publish()}
        publishing={publishing}
      />
      <div className="flex-1 flex min-h-0">
        <BuilderSidebar />
        <BuilderCanvas />
      </div>
    </div>
  );
}
