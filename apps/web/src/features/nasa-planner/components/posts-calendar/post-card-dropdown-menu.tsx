"use client";

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreVerticalIcon, ImagePlusIcon, VideoIcon, SparklesIcon,
  CheckCircle2Icon, ClockIcon, SendIcon, DownloadIcon,
  RocketIcon, TrashIcon, CheckIcon,
} from "lucide-react";
import { POST_STATUSES } from "../../constants";
import type { MenuAction } from "./types";

interface Post {
  id: string;
  status: string;
  type?: string | null;
  videoKey?: string | null;
  thumbnail?: string | null;
}

interface Props {
  post: Post;
  onAction: (action: MenuAction) => void;
}

export function PostCardDropdownMenu({ post, onAction }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 z-20 size-5 bg-black/50 hover:bg-black/70 text-white rounded p-0"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
        >
          <MoreVerticalIcon className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-50">
        {post.type !== "REEL" && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction({ type: "editImage" }); }}>
            <ImagePlusIcon className="size-3.5 mr-2 text-pink-500" />Editar Imagem
          </DropdownMenuItem>
        )}
        {(post.type === "REEL" || !!post.videoKey) && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction({ type: "editVideo" }); }}>
            <VideoIcon className="size-3.5 mr-2 text-violet-500" />Editar Vídeo
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction({ type: "generate" }); }}>
          <SparklesIcon className="size-3.5 mr-2" />Gerar com IA
        </DropdownMenuItem>
        {post.status === "PENDING_APPROVAL" && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction({ type: "approve" }); }}>
            <CheckCircle2Icon className="size-3.5 mr-2" />Aprovar
          </DropdownMenuItem>
        )}
        {post.status === "APPROVED" && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction({ type: "schedule" }); }}>
            <ClockIcon className="size-3.5 mr-2" />Agendar
          </DropdownMenuItem>
        )}
        {post.status !== "PUBLISHED" && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction({ type: "publish" }); }}>
            <SendIcon className="size-3.5 mr-2 text-violet-500" />Publicar Agora
          </DropdownMenuItem>
        )}
        {post.thumbnail && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction({ type: "download" }); }}>
            <DownloadIcon className="size-3.5 mr-2" />Baixar Imagem
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
            <RocketIcon className="size-3.5 mr-2" />Mover para
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {POST_STATUSES.map((s) => (
              <DropdownMenuItem
                key={s.key}
                disabled={post.status === s.key}
                onClick={(e) => { e.stopPropagation(); onAction({ type: "moveTo", status: s.key }); }}
              >
                {post.status === s.key
                  ? <CheckIcon className="size-3 mr-2" />
                  : <span className="size-3 mr-2 inline-block" />}
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={(e) => { e.stopPropagation(); onAction({ type: "delete" }); }}
        >
          <TrashIcon className="size-3.5 mr-2" />Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
