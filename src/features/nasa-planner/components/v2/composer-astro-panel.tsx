"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import type { NasaPlannerPostType } from "@/generated/prisma/enums";
import { useGeneratePlannerScripts, usePlannerBrandKit } from "../../hooks/use-planner-brand-kit";
import { POST_TYPE_META } from "./planner-v2-utils";

/** "Gerar com o Astro" no Roteiro (spec 0063, RF-5/RF-6): um roteiro por formato; kit incompleto desliga o botão. */

export interface GeneratedPostDraft {
  title: string;
  script: string;
  caption: string;
  hashtags: string[];
}

export function ComposerAstroPanel({
  organizationId,
  formats,
  generatedByFormat,
  onGenerated,
}: {
  organizationId: string;
  formats: NasaPlannerPostType[];
  generatedByFormat: Partial<Record<NasaPlannerPostType, GeneratedPostDraft>>;
  onGenerated: (drafts: Partial<Record<NasaPlannerPostType, GeneratedPostDraft>>) => void;
}) {
  const [idea, setIdea] = useState("");
  const { brandKit, isLoading } = usePlannerBrandKit(organizationId || null);
  const generateScripts = useGeneratePlannerScripts();
  const isKitComplete = Boolean(brandKit?.completeness.isComplete);
  const generatedFormats = formats.filter((format) => generatedByFormat[format]);

  const generate = () =>
    generateScripts.mutate(
      { organizationId, idea, formats },
      {
        onSuccess: ({ scripts }) => {
          const drafts = Object.fromEntries(
            scripts.map((script) => [
              script.format,
              {
                title: script.title,
                script: [script.script, script.artDirection && `Direção de arte: ${script.artDirection}`, script.cta && `CTA: ${script.cta}`].filter(Boolean).join("\n\n"),
                caption: script.caption,
                hashtags: script.hashtags,
              },
            ]),
          );
          onGenerated(drafts);
          toast.success(scripts.length > 1 ? `${scripts.length} roteiros prontos. Revise e crie os rascunhos.` : "Roteiro pronto.");
        },
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <section className="rounded-2xl bg-panel p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles className="size-4" /> Gerar com o Astro
      </p>
      {!isLoading && brandKit && !isKitComplete && (
        <div className="mb-3 flex gap-2 rounded-xl bg-warning/10 px-3 py-2 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="font-semibold">Kit da marca incompleto</p>
            <p className="text-xs text-muted-foreground">
              Falta: {brandKit.completeness.missing.join(", ")}. O Astro precisa do kit para criar no tom e nas cores da marca.
            </p>
            <Link href={`/nasa-planner/kit?org=${organizationId}`} className="text-xs font-semibold text-warning underline">
              Completar kit →
            </Link>
          </div>
        </div>
      )}
      <Textarea
        value={idea}
        onChange={(event) => setIdea(event.target.value)}
        placeholder="Sobre o que é o conteúdo? Ex.: lançamento do Planner, sem planilha e com aprovação do cliente."
        className="min-h-16 rounded-2xl border-primary text-sm"
        maxLength={2000}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">Usa a IA do Astro (Satélites). Na chave da plataforma, cobra Stars.</p>
        <button
          type="button"
          data-guide={GUIDE_ANCHORS.plannerAstroGenerate.id}
          disabled={!isKitComplete || idea.trim().length < 5 || formats.length === 0 || generateScripts.isPending}
          onClick={generate}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-sm font-semibold text-background disabled:opacity-35"
        >
          {generateScripts.isPending ? <OrbitaSpinner className="size-3.5" /> : <Sparkles className="size-3.5" />}
          {generateScripts.isPending ? "Gerando…" : "Gerar com o Astro"}
        </button>
      </div>
      {generatedFormats.length > 1 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {generatedFormats.map((format) => {
            const draft = generatedByFormat[format]!;
            return (
              <div key={format} className="rounded-xl bg-card p-2.5 text-xs">
                <p className="mb-1 font-semibold">
                  {POST_TYPE_META[format].label} · {draft.title}
                </p>
                <p className="line-clamp-4 whitespace-pre-wrap text-muted-foreground">{draft.script}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
