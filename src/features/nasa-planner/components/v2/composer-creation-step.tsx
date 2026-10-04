"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PostMediaUploader } from "../post-media-uploader";
import { PostPreview } from "../post-preview";
import { useUpdatePlannerPostV2 } from "../../hooks/use-planner-planning";
import { plannerMediaUrl } from "./planner-v2-utils";
import type { usePlannerPost } from "../../hooks/use-planner-calendar";

/** Passo 2 do criador (spec 0058, RF-10): mídia, legenda e hashtags, com prévia no formato certo. */

type ComposerPost = NonNullable<ReturnType<typeof usePlannerPost>["post"]>;

const STORY_CAPTION_HINT = "O Story não mostra legenda: escreva o texto direto na arte.";

export function StoryFrame({ post }: { post: ComposerPost }) {
  const mediaKey = post.videoKey ?? post.thumbnail ?? post.slides[0]?.imageKey ?? null;
  const mediaUrl = plannerMediaUrl(mediaKey);
  const isVideo = Boolean(post.videoKey);
  return (
    <div className="relative mx-auto h-[374px] w-[210px] overflow-hidden rounded-[28px] border-[6px] border-black bg-knob">
      {mediaUrl && (isVideo
        ? <video src={mediaUrl} className="size-full object-cover" muted loop autoPlay playsInline />
        : <img src={mediaUrl} alt="" className="size-full object-cover" />)}
      <div className="absolute inset-x-2 top-2 flex gap-1">
        <span className="h-0.5 flex-1 rounded-full bg-white" />
        <span className="h-0.5 flex-1 rounded-full bg-white/40" />
      </div>
      {!mediaUrl && <p className="absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-xs text-muted-foreground">A prévia aparece quando você enviar a imagem ou o vídeo.</p>}
    </div>
  );
}

export function ComposerCreationStep({ post, canEdit, onContinue }: { post: ComposerPost; canEdit: boolean; onContinue: () => void }) {
  const [caption, setCaption] = useState(post.caption ?? "");
  const [hashtagsText, setHashtagsText] = useState(post.hashtags.map((hashtag) => `#${hashtag.replace(/^#/, "")}`).join(" "));
  const updatePost = useUpdatePlannerPostV2();
  const isStory = post.type === "STORY";

  const saveAndContinue = () => {
    const hashtags = hashtagsText.split(/[\s,]+/).map((hashtag) => hashtag.replace(/^#/, "").trim()).filter(Boolean);
    updatePost.mutate(
      { postId: post.id, caption, hashtags },
      {
        onSuccess: onContinue,
        onError: (error) => toast.error(error.message || "Não deu para salvar a legenda."),
      },
    );
  };

  return (
    <div className="grid gap-0 md:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-4 p-5">
        {canEdit && (
          <PostMediaUploader
            postId={post.id}
            postType={post.type}
            hasImage={Boolean(post.thumbnail)}
            hasVideo={Boolean(post.videoKey)}
            thumbnailUrl={plannerMediaUrl(post.thumbnail) ?? null}
            slides={post.slides}
          />
        )}
        <div>
          <p className="mb-2 text-xs text-muted-foreground">{isStory ? "Anotação (não aparece no Story)" : "Legenda"}</p>
          <Textarea value={caption} disabled={!canEdit} onChange={(event) => setCaption(event.target.value)} className="min-h-28 rounded-2xl" maxLength={2200} />
          <p className="mt-1 text-right text-[11px] text-muted-foreground">{isStory ? STORY_CAPTION_HINT : `${caption.length}/2200`}</p>
        </div>
        {!isStory && (
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Hashtags</p>
            <Input value={hashtagsText} disabled={!canEdit} onChange={(event) => setHashtagsText(event.target.value)} placeholder="#marketing #dicas" className="rounded-2xl" />
          </div>
        )}
        {post.script && (
          <div className="rounded-2xl bg-panel p-3 text-sm">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Roteiro</p>
            <p className="whitespace-pre-wrap">{post.script}</p>
          </div>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={canEdit ? saveAndContinue : onContinue}
            disabled={updatePost.isPending}
            className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:opacity-40"
          >
            {updatePost.isPending ? "Salvando…" : "Continuar para revisão"}
          </button>
        </div>
      </div>
      <div className="flex flex-col items-center gap-3 bg-panel p-5">
        <p className="text-xs text-muted-foreground">Prévia</p>
        {isStory ? <StoryFrame post={post} /> : <PostPreview post={{ ...post, caption, hashtags: hashtagsText.split(/\s+/).filter(Boolean) }} />}
      </div>
    </div>
  );
}
