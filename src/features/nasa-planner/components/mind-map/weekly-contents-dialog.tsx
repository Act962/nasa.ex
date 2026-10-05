"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePlannerBrandKit, useGeneratePlannerScripts } from "../../hooks/use-planner-brand-kit";
import { useCreatePlannerClientPost } from "../../hooks/use-planner-planning";
import type { PendingContent } from "../../lib/mind-map/weekly-map";
import { POST_TYPE_META } from "../v2/planner-v2-utils";

/** "Criar conteúdos" (spec 0068, RF-4): cada card novo do mapa vira uma pauta no Planner; o Astro pode escrever roteiro e legenda. */

const SHEET_ON_MOBILE =
  "max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-t-[26px] max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[calc(1rem+env(safe-area-inset-bottom))] max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=open]:zoom-in-100";

function buildIdea(content: PendingContent) {
  return [content.title, content.theme ? `Objetivo / gatilho do dia: ${content.theme}.` : null, content.references.length ? `Referências: ${content.references.join("; ")}` : null]
    .filter(Boolean)
    .join("\n");
}

export function WeeklyContentsDialog({
  isOpen,
  organizationId,
  pendingContents,
  onCreated,
  onClose,
}: {
  isOpen: boolean;
  organizationId: string;
  pendingContents: PendingContent[];
  onCreated: (nodeId: string, postId: string) => void;
  onClose: () => void;
}) {
  const [shouldWriteWithAstro, setShouldWriteWithAstro] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const { brandKit } = usePlannerBrandKit(isOpen ? organizationId : null);
  const createPost = useCreatePlannerClientPost();
  const generateScripts = useGeneratePlannerScripts();
  const isKitComplete = Boolean(brandKit?.completeness.isComplete);
  const isRunning = progress !== null;

  const createAll = async () => {
    setProgress({ done: 0, total: pendingContents.length });
    let createdCount = 0;
    let astroFailures = 0;
    try {
      for (const content of pendingContents) {
        let generated: { script?: string; caption?: string; hashtags?: string[]; cta?: string } = {};
        if (shouldWriteWithAstro && isKitComplete) {
          try {
            const result = await generateScripts.mutateAsync({ organizationId, idea: buildIdea(content), formats: [content.format] });
            generated = result.scripts[0] ?? {};
          } catch {
            // O conteúdo é criado mesmo assim, só sem o texto do Astro.
            astroFailures += 1;
          }
        }
        const { post } = await createPost.mutateAsync({
          organizationId,
          type: content.format,
          status: "IDEA",
          title: content.title.slice(0, 200),
          objective: content.theme?.slice(0, 200) || undefined,
          script: generated.script || (content.references.length ? `Referências:\n${content.references.join("\n")}` : undefined),
          caption: generated.caption?.slice(0, 2200) || undefined,
          cta: generated.cta?.slice(0, 300) || undefined,
          hashtags: generated.hashtags,
          intendedAt: content.intendedAt,
        });
        onCreated(content.nodeId, post.id);
        createdCount += 1;
        setProgress({ done: createdCount, total: pendingContents.length });
      }
      toast.success(`${createdCount} conteúdo${createdCount === 1 ? "" : "s"} criado${createdCount === 1 ? "" : "s"} no Planner.`);
      if (astroFailures > 0) toast.warning(`${astroFailures} ficaram sem o texto do Astro. Abra o post e use "Gerar com o Astro".`);
      onClose();
    } catch (error) {
      toast.error(`${createdCount} de ${pendingContents.length} criados. ${error instanceof Error ? error.message : ""}`);
    } finally {
      setProgress(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isRunning && onClose()}>
      <DialogContent className={cn("max-h-[90dvh] overflow-y-auto rounded-[22px] sm:max-w-lg", SHEET_ON_MOBILE)}>
        <DialogHeader className="text-left">
          <DialogTitle>Criar conteúdos</DialogTitle>
          <DialogDescription>
            {pendingContents.length === 0
              ? "Não há cards novos dentro dos dias. Adicione um card em um dia e volte aqui."
              : "Cada card novo vira uma pauta no Planner, no dia em que está, com o tema do dia como objetivo. A arte você cria depois, no post."}
          </DialogDescription>
        </DialogHeader>

        {pendingContents.length > 0 && (
          <>
            <div className="space-y-1.5">
              {pendingContents.map((content) => (
                <div key={content.nodeId} className="flex items-start gap-3 rounded-2xl bg-panel p-2.5">
                  <span className="w-9 pt-0.5 text-[11px] font-bold text-muted-foreground uppercase">{content.dayLabel.slice(0, 3)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{content.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {POST_TYPE_META[content.format].label}
                      {content.theme && ` · ${content.theme}`}
                      {content.references.length > 0 && ` · ${content.references.length} referência${content.references.length > 1 ? "s" : ""}`}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <label className={cn("flex items-start gap-2.5 rounded-2xl bg-panel p-3", !isKitComplete && "opacity-60")}>
              <input type="checkbox" className="mt-0.5" disabled={!isKitComplete || isRunning} checked={shouldWriteWithAstro && isKitComplete} onChange={(event) => setShouldWriteWithAstro(event.target.checked)} />
              <span className="min-w-0 text-sm">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Sparkles className="size-3.5" /> Escrever roteiro e legenda com o Astro
                </span>
                <span className="block text-xs text-muted-foreground">
                  {isKitComplete ? (
                    "Usa o Kit da Marca e o tema do dia. Conta um prompt do Astro por conteúdo na chave da plataforma."
                  ) : (
                    <>
                      Kit da marca incompleto.{" "}
                      <Link href={`/nasa-planner/kit?org=${organizationId}`} className="underline">
                        Completar o kit
                      </Link>
                    </>
                  )}
                </span>
              </span>
            </label>

            <button type="button" disabled={isRunning} onClick={() => void createAll()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-semibold text-background disabled:opacity-60">
              {isRunning && <OrbitaSpinner className="size-4" />}
              {isRunning ? `Criando ${progress.done + 1} de ${progress.total}…` : `Criar ${pendingContents.length} conteúdo${pendingContents.length === 1 ? "" : "s"}`}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
