"use client";

import { useState } from "react";
import { ImageIcon, Sparkles, VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { useAddTrafegoCreative } from "@/features/trafego/hooks/use-trafego-orders";
import { useAnalyzeTrafegoCreative } from "@/features/trafego/hooks/use-trafego-creative-review";
import type { CreativeReview } from "@/features/trafego/lib/creative-review";
import { creativeReviewSchema } from "@/features/trafego/lib/creative-review/schema";
import { uploadImage, uploadVideo } from "@/features/trafego/utils/upload-creative-file";
import { MAX_UPLOADED_CREATIVES } from "@/features/trafego/lib/creative-limits";
import type { CreativeFramesResult } from "@/features/trafego/utils/creative-frames";
import { CreativeIntake } from "./creative-intake";
import { CreativeReviewResult } from "./creative-review-result";

/**
 * Criativo do pedido no painel enquanto a campanha não está no ar (spec 0126,
 * RF-9, CA-12): envia, o Astro analisa e a análise fica guardada no criativo.
 */

interface OrderCreative {
  id: string;
  kind: "IMAGE" | "VIDEO";
  url: string;
  fileName: string | null;
  astroReview?: unknown;
}

function readStoredReview(raw: unknown): CreativeReview | null {
  const parsed = creativeReviewSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function OrderCreativeCard({
  orderId,
  creatives,
  isReadOnly,
  isLinkEnabled,
}: {
  orderId: string;
  creatives: OrderCreative[];
  isReadOnly: boolean;
  isLinkEnabled: boolean;
}) {
  const [linkReview, setLinkReview] = useState<CreativeReview | null>(null);
  const [analyzingCreativeId, setAnalyzingCreativeId] = useState<string | null>(null);
  const addCreative = useAddTrafegoCreative();
  const analyze = useAnalyzeTrafegoCreative();
  const isFull = creatives.length >= MAX_UPLOADED_CREATIVES;

  async function handleFile(file: File, frames: CreativeFramesResult) {
    const fileKey = frames.kind === "VIDEO" ? await uploadVideo(file) : await uploadImage(file);
    const created = await addCreative.mutateAsync({
      orderId,
      kind: frames.kind,
      fileKey,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      width: frames.width ?? undefined,
      height: frames.height ?? undefined,
      durationSeconds: frames.durationSeconds ?? undefined,
    });
    setAnalyzingCreativeId(created.id);
    analyze.mutate(
      {
        orderId,
        creativeId: created.id,
        source: {
          type: "frames",
          frames: frames.frames,
          technical: {
            kind: frames.kind,
            width: frames.width,
            height: frames.height,
            durationSeconds: frames.durationSeconds,
            fileSize: file.size,
          },
        },
      },
      {
        onError: (error) => toast.error(error.message),
        onSettled: () => setAnalyzingCreativeId(null),
      },
    );
  }

  async function handleLink(link: string) {
    await analyze.mutateAsync(
      { orderId, source: { type: "post", link } },
      { onSuccess: setLinkReview, onError: (error) => toast.error(error.message) },
    ).catch(() => null);
  }

  function analyzeStored(creative: OrderCreative) {
    setAnalyzingCreativeId(creative.id);
    analyze.mutate(
      {
        orderId,
        creativeId: creative.id,
        source: {
          type: "frames",
          frames: [],
          technical: { kind: creative.kind, width: null, height: null, durationSeconds: null, fileSize: null },
        },
      },
      {
        onError: (error) => toast.error(error.message),
        onSettled: () => setAnalyzingCreativeId(null),
      },
    );
  }

  return (
    <section className="rounded-[24px] border bg-card p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15">
          <Sparkles className="size-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold">Criativo do anúncio</h2>
          <p className="text-sm text-muted-foreground">
            Envie a imagem ou o vídeo. O Astro dá uma nota e diz o que ajustar antes de publicar.
          </p>
        </div>
      </div>

      {creatives.length > 0 && (
        <div className="mt-4 space-y-3">
          {creatives.map((creative) => {
            const review = readStoredReview(creative.astroReview);
            const isAnalyzing = analyzingCreativeId === creative.id;
            return (
              <div key={creative.id} className="rounded-[20px] border p-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-muted">
                    {creative.kind === "IMAGE" ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL assinada do storage
                      <img src={creative.url} alt={creative.fileName ?? "Criativo"} className="size-full object-cover" />
                    ) : (
                      <VideoIcon className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {creative.kind === "IMAGE" ? <ImageIcon className="size-3.5" /> : <VideoIcon className="size-3.5" />}
                      {creative.fileName ?? (creative.kind === "IMAGE" ? "Imagem" : "Vídeo")}
                    </p>
                    {!review && !isAnalyzing && !isReadOnly && (
                      <Button size="sm" variant="ghost" className="mt-1 h-8 rounded-full px-2" onClick={() => analyzeStored(creative)}>
                        <Sparkles className="size-3.5" />
                        Analisar com o Astro
                      </Button>
                    )}
                    {isAnalyzing && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <OrbitaSpinner className="size-3.5" />O Astro está analisando…
                      </p>
                    )}
                  </div>
                </div>
                {review && <CreativeReviewResult review={review} className="mt-3" />}
              </div>
            );
          })}
        </div>
      )}

      {!isReadOnly && !isFull && (
        <div className="mt-4">
          <CreativeIntake
            onFile={handleFile}
            onLink={handleLink}
            isBusy={addCreative.isPending || analyze.isPending}
            isLinkEnabled={isLinkEnabled}
          />
        </div>
      )}

      {linkReview && <CreativeReviewResult review={linkReview} className="mt-4" />}
    </section>
  );
}
