"use client";

import { useRef } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { PostPreview } from "../post-preview";
import { usePlannerPostMetrics } from "../../hooks/use-planner-publishing";
import { CommentsAutomationPanel } from "./comments-automation-panel";
import { PostCommentsSection } from "./post-comments-section";
import { StoryFrame } from "./composer-creation-step";
import type { usePlannerPost } from "../../hooks/use-planner-calendar";

/** Post publicado: números reais da Meta à esquerda e o celular com a publicação como ficou à direita. */

type ComposerPost = NonNullable<ReturnType<typeof usePlannerPost>["post"]>;

function MetricCard({ value, label, isLoading, onSelect }: { value: number | null | undefined; label: string; isLoading: boolean; onSelect?: () => void }) {
  const Container = onSelect ? "button" : "div";
  return (
    <Container type={onSelect ? "button" : undefined} onClick={onSelect} className={cn("rounded-2xl bg-panel p-3 text-left", onSelect && "hover:ring-2 hover:ring-foreground/15")}>
      <p className={cn("text-xl font-bold", isLoading && "animate-pulse text-muted-foreground")}>
        {isLoading ? "…" : value != null ? value.toLocaleString("pt-BR") : "—"}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Container>
  );
}

export function PublishedPostView({ post, canReplyToComments }: { post: ComposerPost; canReplyToComments: boolean }) {
  const commentsSectionRef = useRef<HTMLElement>(null);
  const scrollToComments = () => commentsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const isStory = post.type === "STORY";
  const isReel = post.type === "REEL";
  const isOnInstagram = Boolean(post.externalIgPostId);
  const { postMetrics, isLoading, isFetching, refetch } = usePlannerPostMetrics(post.id, { enabled: isOnInstagram });
  const metrics = postMetrics?.metrics;
  const handle = postMetrics?.account?.username;
  // A mídia que a Meta devolve é a que foi ao ar; a nossa pode ter sumido (link temporário, arquivo apagado).
  const postAsPublished = metrics?.mediaUrl
    ? isReel || (isStory && post.videoKey)
      ? { ...post, videoKey: metrics.mediaUrl }
      : post.type === "CAROUSEL"
        ? post
        : { ...post, thumbnail: metrics.mediaUrl }
    : post;
  const isLoadingMetrics = isOnInstagram && isLoading;
  const metricCards = isStory
    ? [
        { label: "visualizações", value: metrics?.views },
        { label: "contas alcançadas", value: metrics?.reach },
      ]
    : [
        { label: "curtidas", value: metrics?.likeCount },
        { label: "comentários", value: metrics?.commentsCount, isCommentsCard: true },
        isReel ? { label: "reproduções", value: metrics?.views } : { label: "contas alcançadas", value: metrics?.reach },
      ];

  return (
    <div className="grid gap-0 md:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-4 p-5">
        <div>
          <p className="text-lg font-bold text-success">Publicado</p>
          <p className="text-sm text-muted-foreground">
            {post.publishedAt && format(new Date(post.publishedAt), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
            {handle && ` · @${handle}`}
          </p>
        </div>

        {isOnInstagram && (
          <div>
            <div className={cn("grid gap-2", metricCards.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
              {metricCards.map((card) => (
                <MetricCard key={card.label} value={card.value} label={card.label} isLoading={isLoadingMetrics} onSelect={"isCommentsCard" in card ? scrollToComments : undefined} />
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {postMetrics?.error
                ? postMetrics.error
                : postMetrics
                  ? `Atualizado ${formatDistanceToNow(new Date(postMetrics.fetchedAt), { locale: ptBR, addSuffix: true })} · números da Meta${isStory ? " (o Story guarda por 24 h)" : ""}`
                  : "Buscando os números na Meta…"}
            </p>
          </div>
        )}

        {!isStory && post.caption && (
          <div className="rounded-2xl bg-panel p-3 text-sm">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Legenda publicada</p>
            <p className="whitespace-pre-wrap">{post.caption}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {post.externalIgPermalink && (
            <a href={post.externalIgPermalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-panel px-4 py-2 text-sm font-medium">
              Ver no Instagram <ExternalLink className="size-3.5" />
            </a>
          )}
          {isOnInstagram && (
            <button
              type="button"
              disabled={isFetching}
              onClick={() => void refetch()}
              className="inline-flex items-center gap-1.5 rounded-full bg-panel px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              <RotateCw className={cn("size-3.5", isFetching && "animate-spin")} /> Atualizar números
            </button>
          )}
        </div>

        {isOnInstagram && !isStory && (
          <PostCommentsSection ref={commentsSectionRef} postId={post.id} canReply={canReplyToComments} totalCount={metrics?.commentsCount} />
        )}

        {post.targetNetworks.includes("INSTAGRAM") && !isStory && <CommentsAutomationPanel postId={post.id} />}
      </div>

      <div className="flex flex-col items-center gap-3 bg-panel p-5">
        <p className="text-xs text-muted-foreground">Como ficou no Instagram</p>
        {isStory ? (
          <StoryFrame post={postAsPublished} />
        ) : (
          <PostPreview
            post={postAsPublished}
            published={{ handle, likeCount: metrics?.likeCount, commentsCount: metrics?.commentsCount, publishedAt: post.publishedAt }}
          />
        )}
      </div>
    </div>
  );
}
