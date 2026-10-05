"use client";

import { createContext, useContext } from "react";
import { Handle, Position } from "@xyflow/react";
import { format } from "date-fns";
import { Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NasaPlannerPostStatus, NasaPlannerPostType } from "@/generated/prisma/enums";
import { POST_STATUS_META, POST_TYPE_META } from "../v2/planner-v2-utils";

/** Nós de conteúdo do mapa mental (spec 0068): card de post do Planner e link. */

export interface MapPostInfo {
  status: NasaPlannerPostStatus;
  scheduledAt: Date | string | null;
  title: string | null;
}

/** Posts da semana por id, para o card mostrar o status de verdade sem guardar cópia no mapa. */
export const MindMapPostsContext = createContext<Map<string, MapPostInfo>>(new Map());

export interface PostNodeData {
  postId?: string;
  title?: string;
  format?: NasaPlannerPostType;
}

export function PostCardBody({ data, className }: { data: PostNodeData; className?: string }) {
  const postsById = useContext(MindMapPostsContext);
  const post = data.postId ? postsById.get(data.postId) : undefined;
  const typeMeta = POST_TYPE_META[data.format ?? "STATIC"];
  const title = post?.title || data.title || typeMeta.label;
  return (
    <div className={cn("rounded-[14px] border border-line bg-card p-2.5 text-left", className)}>
      <p className="line-clamp-2 text-[13px] leading-snug font-semibold">{title}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-panel px-2 py-0.5 text-[10px]">
          <typeMeta.icon className="size-3" /> {typeMeta.label}
        </span>
        {post ? (
          <span className={cn("rounded-full bg-panel px-2 py-0.5 text-[10px] font-medium", POST_STATUS_META[post.status].textClassName)}>{POST_STATUS_META[post.status].label}</span>
        ) : (
          <span className="rounded-full border border-dashed border-line px-2 py-0.5 text-[10px] text-muted-foreground">{data.postId ? "Post apagado" : "Novo · ainda não criado"}</span>
        )}
        {post?.scheduledAt && <span className="rounded-full bg-panel px-2 py-0.5 text-[10px] text-muted-foreground">{format(new Date(post.scheduledAt), "HH:mm")}</span>}
      </div>
    </div>
  );
}

export function PostNode({ data, selected }: { data: PostNodeData; selected?: boolean }) {
  return (
    <>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
      <PostCardBody data={data} className={cn("w-[250px] cursor-pointer shadow-md select-none", selected && "ring-2 ring-info")} />
    </>
  );
}

export interface LinkNodeData {
  label?: string;
  url?: string;
}

export function LinkPill({ data, className }: { data: LinkNodeData; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5 rounded-full border border-dashed border-info/50 bg-info/10 px-3 py-1.5 text-xs text-info", className)}>
      <Link2 className="size-3.5 shrink-0" />
      <span className="truncate">{data.label || data.url || "Link"}</span>
    </div>
  );
}

export function LinkNode({ data, selected }: { data: LinkNodeData; selected?: boolean }) {
  return (
    <>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
      <LinkPill data={data} className={cn("max-w-[220px] cursor-pointer select-none", selected && "ring-2 ring-info")} />
    </>
  );
}
