"use client";

import { useDraggable } from "@dnd-kit/core";
import { format } from "date-fns";
import { MessageCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientAvatar } from "./client-avatar";
import { POST_STATUS_META, POST_TYPE_META, instagramAccountsOf, plannerMediaUrl, postDate, resolvePostInstagramAccount } from "./planner-v2-utils";
import type { CalendarPost, PlannerClient } from "./planner-v2-types";

/** Post no calendário: miniatura, título, cliente, formato, horário e status. Arrastável para reprogramar. */
export function CalendarPostChip({
  post,
  client,
  clientIndex,
  isCompact = false,
  onOpen,
  onRetry,
}: {
  post: CalendarPost;
  client: PlannerClient | undefined;
  clientIndex: number;
  isCompact?: boolean;
  onOpen: (postId: string) => void;
  onRetry: (postId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `post:${post.id}`,
    data: { kind: "post", postId: post.id, status: post.status, groupPostIds: post.groupPostIds },
    disabled: post.status === "PUBLISHED" || post.status === "PUBLISHING",
  });
  const typeMeta = POST_TYPE_META[post.type];
  const statusMeta = POST_STATUS_META[post.status];
  const date = postDate(post);
  const thumbnailUrl = plannerMediaUrl(post.thumbnail);
  const isFailed = post.status === "FAILED";
  // Com uma conta só, o avatar do cliente já diz de quem é o post.
  const instagramAccount = instagramAccountsOf(client).length > 1 ? resolvePostInstagramAccount(post, client) : null;
  const groupAccountCount = post.groupAccountCount ?? 1;
  const accountHandle = groupAccountCount > 1 ? `${groupAccountCount} contas` : instagramAccount ? `@${instagramAccount.igUsername ?? instagramAccount.igUserId}` : null;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(post.id)}
      onKeyDown={(event) => event.key === "Enter" && onOpen(post.id)}
      className={cn(
        "group flex w-full cursor-grab items-center gap-1.5 rounded-[14px] bg-panel p-1 pr-2 text-left text-[11.5px] transition hover:bg-knob/60 active:cursor-grabbing",
        isFailed && "ring-1 ring-destructive",
        isDragging && "opacity-40",
      )}
    >
      <span
        className={cn(
          "relative grid shrink-0 place-items-center overflow-hidden rounded-[10px] bg-knob text-muted-foreground",
          typeMeta.isVertical ? "h-8 w-5" : "size-7",
          isCompact && (typeMeta.isVertical ? "h-6 w-4" : "size-5"),
        )}
      >
        {thumbnailUrl ? <img src={thumbnailUrl} alt="" className="size-full object-cover" /> : <typeMeta.icon className="size-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground" title={accountHandle ? `${post.title || typeMeta.label} · ${accountHandle}` : undefined}>
          {post.title || typeMeta.label}
        </span>
        {!isCompact && (
          <span className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
            {client && <ClientAvatar name={client.name} logo={client.logo} clientIndex={clientIndex} className="size-3.5 text-[6px] ring-1" />}
            <span className="truncate">
              {typeMeta.label}
              {date && ` · ${format(date, "HH:mm")}`}
              {accountHandle && ` · ${accountHandle}`}
            </span>
            {post.commentsAutomationId && <MessageCircle className="size-3 shrink-0" aria-label="Com automação de comentários" />}
            <span className={cn("size-1.5 shrink-0 rounded-full", statusMeta.dotClassName)} title={statusMeta.label} />
          </span>
        )}
        {isFailed && !isCompact && (
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onRetry(post.id);
            }}
            className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] font-medium text-destructive hover:underline"
          >
            <RotateCcw className="size-3" /> Tentar de novo
          </button>
        )}
      </span>
    </div>
  );
}
