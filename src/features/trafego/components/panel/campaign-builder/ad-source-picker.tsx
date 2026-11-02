"use client";

import { AlertTriangle, CheckCircle2, ImageIcon, Instagram } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useCampaignInstagramPosts } from "@/features/trafego/hooks/use-trafego-campaign-builder";
import { prescreenAdContent } from "@/features/trafego/lib/ad-policies";

/** Anúncio: post do Instagram (caminho principal) ou imagem dos Materiais com uma copy (spec 0124, RF-5). */

export type AdSourceSelection =
  | { kind: "instagram_post"; mediaId: string; text: string; previewUrl: string | null }
  | { kind: "image"; creativeId: string; copyId: string; text: string; previewUrl: string | null };

interface AdSourcePickerProps {
  orderId: string;
  pageId: string | null;
  images: { id: string; fileName: string | null; url: string }[];
  copies: { id: string; headline: string | null; primaryText: string; isSelected: boolean }[];
  selection: AdSourceSelection | null;
  onChange: (selection: AdSourceSelection | null) => void;
  isWarningConfirmed: boolean;
  onWarningConfirmedChange: (isConfirmed: boolean) => void;
}

export function AdSourcePicker({
  orderId,
  pageId,
  images,
  copies,
  selection,
  onChange,
  isWarningConfirmed,
  onWarningConfirmedChange,
}: AdSourcePickerProps) {
  const { data: postsResult, isLoading } = useCampaignInstagramPosts(orderId, pageId);
  const prescreen = selection ? prescreenAdContent({ platform: "META_ADS", texts: [selection.text] }) : null;
  const imageSelection = selection?.kind === "image" ? selection : null;

  return (
    <div className="space-y-5">
      <section>
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Instagram className="size-4" />
          Usar um post do Instagram
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          O caminho recomendado: o anúncio leva as curtidas e os comentários do post.
        </p>
        {isLoading && <OrbitaSpinner className="mt-3 size-4" />}
        {postsResult && postsResult.status !== "ok" && (
          <p className="mt-2 rounded-[14px] border border-warning/40 bg-warning/10 px-3 py-2 text-xs">{postsResult.message}</p>
        )}
        {postsResult?.status === "ok" && (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {postsResult.posts.map((post) => {
                const isChosen = selection?.kind === "instagram_post" && selection.mediaId === post.id;
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() =>
                      onChange({ kind: "instagram_post", mediaId: post.id, text: post.caption ?? "", previewUrl: post.previewUrl })
                    }
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-[14px] border bg-muted",
                      isChosen && "ring-2 ring-primary",
                    )}
                    title={post.caption ?? undefined}
                  >
                    {post.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL temporária do CDN da Meta
                      <img src={post.previewUrl} alt={post.caption ?? "Post do Instagram"} className="size-full object-cover" />
                    ) : (
                      <span className="text-xs text-muted-foreground">{post.mediaType}</span>
                    )}
                    {isChosen && <CheckCircle2 className="absolute top-1.5 right-1.5 size-5 text-primary" />}
                  </button>
                );
              })}
            </div>
            {postsResult.excludedCount > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {postsResult.excludedCount} post(s) não podem virar anúncio (story, música com direitos ou outra regra da Meta).
              </p>
            )}
          </>
        )}
      </section>

      {images.length > 0 && copies.length > 0 && (
        <section>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <ImageIcon className="size-4" />
            Ou uma imagem dos Materiais
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((image) => {
              const isChosen = imageSelection?.creativeId === image.id;
              const copy = copies.find((item) => item.id === imageSelection?.copyId) ?? copies[0];
              return (
                <button
                  key={image.id}
                  type="button"
                  onClick={() =>
                    onChange({
                      kind: "image",
                      creativeId: image.id,
                      copyId: copy.id,
                      text: [copy.headline, copy.primaryText].filter(Boolean).join("\n"),
                      previewUrl: image.url,
                    })
                  }
                  className={cn("relative aspect-square overflow-hidden rounded-[14px] border bg-muted", isChosen && "ring-2 ring-primary")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- arquivo do R2 do próprio pedido */}
                  <img src={image.url} alt={image.fileName ?? "Imagem"} className="size-full object-cover" />
                  {isChosen && <CheckCircle2 className="absolute top-1.5 right-1.5 size-5 text-primary" />}
                </button>
              );
            })}
          </div>
          {imageSelection && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs text-muted-foreground">Texto do anúncio</p>
              {copies.map((copy) => (
                <button
                  key={copy.id}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...imageSelection,
                      copyId: copy.id,
                      text: [copy.headline, copy.primaryText].filter(Boolean).join("\n"),
                    })
                  }
                  className={cn(
                    "w-full rounded-[14px] border px-3 py-2 text-left text-xs",
                    imageSelection.copyId === copy.id && "border-primary bg-primary/5",
                  )}
                >
                  {copy.headline && <span className="font-medium">{copy.headline} · </span>}
                  {copy.primaryText.slice(0, 140)}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {prescreen && prescreen.hits.length > 0 && (
        <div className="space-y-2">
          {prescreen.hits.map((hit) => (
            <p
              key={hit.ruleId}
              className={cn(
                "flex items-start gap-2 rounded-[14px] border px-3 py-2 text-xs",
                hit.level === "BLOCKED" ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/10",
              )}
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <strong>{hit.label}.</strong> {hit.reason} {hit.fix}
              </span>
            </p>
          ))}
          {prescreen.level === "WARNING" && (
            <label className="flex items-start gap-2 text-xs">
              <Checkbox checked={isWarningConfirmed} onCheckedChange={(value) => onWarningConfirmedChange(value === true)} />
              Li o aviso e quero seguir assim mesmo.
            </label>
          )}
        </div>
      )}
    </div>
  );
}

export function isAdSourceBlocked(selection: AdSourceSelection | null, isWarningConfirmed: boolean): boolean {
  if (!selection) return true;
  const prescreen = prescreenAdContent({ platform: "META_ADS", texts: [selection.text] });
  return prescreen.level === "BLOCKED" || (prescreen.level === "WARNING" && !isWarningConfirmed);
}

export function toAdSourceInput(selection: AdSourceSelection) {
  return selection.kind === "instagram_post"
    ? { kind: "instagram_post" as const, mediaId: selection.mediaId }
    : { kind: "image" as const, creativeId: selection.creativeId, copyId: selection.copyId };
}
