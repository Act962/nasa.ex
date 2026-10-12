"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Editor } from "./editor";

// O Astro altera o fluxo salvo (spec 0094, RF-9). O link "Ver no editor" do cartão dele traz
// `?astroEdit=…`: aí o fluxo é buscado de novo e o desenho é remontado com o que foi gravado.

export function EditorWithAstroReload({ workflowId }: { workflowId: string }) {
  const astroEditMark = useSearchParams().get("astroEdit");
  const queryClient = useQueryClient();
  const [loadedMark, setLoadedMark] = useState<string | null>(null);

  useEffect(() => {
    if (!astroEditMark || astroEditMark === loadedMark) return;
    let isCancelled = false;
    void queryClient.refetchQueries({ queryKey: orpc.workflow.getOne.key({ input: { workflowId } }) }).then(() => {
      if (!isCancelled) setLoadedMark(astroEditMark);
    });
    return () => {
      isCancelled = true;
    };
  }, [astroEditMark, loadedMark, queryClient, workflowId]);

  return <Editor key={loadedMark ?? "salvo"} workflowId={workflowId} />;
}
