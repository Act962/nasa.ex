"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Skeleton } from "@/components/ui/skeleton";
import { youtubeEmbedUrl } from "../lib/youtube";
import { StepScreenshot } from "./step-screenshot";
import { ChevronRight, Play } from "lucide-react";
import type { StepAnnotation } from "../types";

interface Props {
  categorySlug: string;
  featureSlug: string;
}

export function FeatureArticle({ categorySlug, featureSlug }: Props) {
  const { data, isLoading } = useQuery({
    ...orpc.spaceHelp.getFeature.queryOptions({
      input: { categorySlug, featureSlug },
    }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="aspect-video w-full" />
      </div>
    );
  }

  if (!data) return null;
  const { category, feature } = data;
  const embed = youtubeEmbedUrl(feature.youtubeUrl);

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <span>Space Help</span>
        <ChevronRight className="size-3.5" />
        <span>{category.name}</span>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">{feature.title}</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
        {feature.title}
      </h1>
      {feature.summary && (
        <p className="mt-2 text-muted-foreground">{feature.summary}</p>
      )}

      {embed && (
        <div className="mt-6 overflow-hidden rounded-xl border border-border shadow-sm">
          <div className="aspect-video bg-black">
            <iframe
              src={embed}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={feature.title}
            />
          </div>
        </div>
      )}

      {!embed && feature.youtubeUrl && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
          <Play className="size-4" />
          URL de vídeo inválida — peça a um moderador para corrigir.
        </div>
      )}

      <ol className="mt-10 space-y-12">
        {feature.steps.map((step, idx) => (
          <li key={step.id} className="relative">
            <div className="flex items-baseline gap-3 mb-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white text-sm font-bold">
                {idx + 1}
              </span>
              <h3 className="text-lg md:text-xl font-semibold leading-tight">
                {step.title}
              </h3>
            </div>
            <p className="ml-11 text-sm md:text-base text-foreground/80 leading-relaxed">
              {step.description}
            </p>
            <div className="ml-11 mt-4">
              <StepScreenshot
                src={step.screenshotUrl ?? null}
                alt={step.title}
                annotations={step.annotations as StepAnnotation[] | null}
                showPlaceholder={false}
              />
            </div>
          </li>
        ))}
      </ol>

      {feature.steps.length === 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          Esta funcionalidade ainda não tem passos cadastrados.
        </div>
      )}
    </article>
  );
}
