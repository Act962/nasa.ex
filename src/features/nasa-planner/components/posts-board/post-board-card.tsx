"use client";

import {
  SparklesIcon,
  TrashIcon,
  CheckCircle2Icon,
  ClockIcon,
  CalendarCheckIcon,
  CalendarIcon,
  MoreVerticalIcon,
  RocketIcon,
  MegaphoneIcon,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckIcon } from "lucide-react";
import { DownloadIcon, ImagePlusIcon, SendIcon, LayersIcon } from "lucide-react";
import { VideoIcon } from "lucide-react";
import { MANUAL_POST_STATUSES, POST_NETWORKS, type ManualPostStatus } from "../../constants";
import type { PlannerPost } from "../../hooks/use-nasa-planner";
import { downloadPlannerImageAsPng, getPlannerMediaUrl } from "../../lib/post-media";
import { PostMetricsRow } from "../post-metrics-row";
import { POST_TYPE_LABELS } from "./post-type-options";

/** Card de um post no quadro por status do Planner antigo. */

export interface PostBoardCardActions {
  onOpen: () => void;
  onEditImage: () => void;
  onEditVideo: () => void;
  onGenerate: () => void;
  onApprove: () => void;
  onSchedule: () => void;
  onPublish: () => void;
  onMove: (status: ManualPostStatus) => void;
  onDelete: () => void;
}

interface PostBoardCardProps {
  post: PlannerPost;
  clientLogoUrl?: string | null;
  isNetworkConnected: (network: string) => boolean;
  actions: PostBoardCardActions;
}

export function PostBoardCard({ post, clientLogoUrl, isNetworkConnected, actions }: PostBoardCardProps) {
  return (
    <Card
        className="cursor-pointer hover:shadow-sm transition-all border hover:border-info/40"
      onClick={actions.onOpen}
    >
      <CardContent className="p-3 space-y-2">
        {post.type === "CAROUSEL" && post.slides?.length > 0 ? (
          <div className="relative rounded-md overflow-hidden w-full bg-muted">
            <div className="grid grid-cols-3 gap-0.5">
              {post.slides.slice(0, 6).map((slide, idx) => (
                <div key={slide.id} className="aspect-square bg-muted overflow-hidden">
                  {slide.imageKey ? (
                    <img
                      src={getPlannerMediaUrl(slide.imageKey)}
                      alt={`Slide ${idx + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <ImagePlusIcon className="size-4 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] font-medium rounded px-1.5 py-0.5 flex items-center gap-1">
              <LayersIcon className="size-2.5" />{post.slides.length}
            </div>
          </div>
        ) : post.thumbnail ? (
          <div className="rounded-md overflow-hidden aspect-square w-full bg-muted">
            <img
              src={getPlannerMediaUrl(post.thumbnail)}
              alt={post.title ?? "Post"}
              className="w-full h-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        ) : post.videoKey ? (
          <div className="rounded-md aspect-square w-full bg-muted overflow-hidden relative">
            <video
              src={getPlannerMediaUrl(post.videoKey)}
              className="w-full h-full object-cover"
              muted
              preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <VideoIcon className="size-8 text-white drop-shadow" />
            </div>
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium line-clamp-2 flex-1">{post.title}</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={(e) => e.stopPropagation()}>
                <MoreVerticalIcon className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {post.type !== "REEL" && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); actions.onEditImage(); }}>
                  <ImagePlusIcon className="size-3.5 mr-2 text-info" />Editar Imagem
                </DropdownMenuItem>
              )}
              {(post.type === "REEL" || !!post.videoKey) && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); actions.onEditVideo(); }}>
                  <VideoIcon className="size-3.5 mr-2 text-info" />Editar Vídeo
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); actions.onGenerate(); }}>
                <SparklesIcon className="size-3.5 mr-2" />Gerar com IA
              </DropdownMenuItem>
              {post.status === "PENDING_APPROVAL" && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); actions.onApprove(); }}>
                  <CheckCircle2Icon className="size-3.5 mr-2" />Aprovar
                </DropdownMenuItem>
              )}
              {post.status === "APPROVED" && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); actions.onSchedule(); }}>
                  <ClockIcon className="size-3.5 mr-2" />Agendar
                </DropdownMenuItem>
              )}
              {post.status !== "PUBLISHED" && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); actions.onPublish(); }}>
                  <SendIcon className="size-3.5 mr-2 text-info" />Publicar Agora
                </DropdownMenuItem>
              )}
              {post.thumbnail && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); downloadPlannerImageAsPng(post.thumbnail!, post.title ?? undefined); }}>
                  <DownloadIcon className="size-3.5 mr-2" />Baixar Imagem
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                  <RocketIcon className="size-3.5 mr-2" />Mover para
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {MANUAL_POST_STATUSES.map((s) => (
                    <DropdownMenuItem
                      key={s.key}
                      disabled={post.status === s.key}
                      onClick={(e) => { e.stopPropagation(); actions.onMove(s.key); }}
                    >
                      {post.status === s.key && <CheckIcon className="size-3 mr-2" />}
                      {post.status !== s.key && <span className="size-3 mr-2" />}
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => { e.stopPropagation(); actions.onDelete(); }}
              >
                <TrashIcon className="size-3.5 mr-2" />Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap gap-1">
          {post.type && <Badge variant="outline" className="text-xs px-1.5 py-0">{POST_TYPE_LABELS[post.type] ?? post.type}</Badge>}
          {post.isAd && (
            <Badge className="text-xs px-1.5 py-0 bg-warning/15 hover:bg-warning/15 text-warning border-warning/30 gap-1">
              <MegaphoneIcon className="size-2.5" />Anúncio
            </Badge>
          )}
          {(post.targetNetworks ?? []).map((net: string) => (
            <Badge key={net} variant="secondary" className="text-xs px-1.5 py-0 gap-1">
              <span className={`size-1.5 rounded-full shrink-0 ${isNetworkConnected(net) ? "bg-success" : "bg-muted-foreground"}`} />
              {POST_NETWORKS[net] ?? net}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {post.clientOrgName?.trim() && (
            <Avatar className="size-5 shrink-0 ring-1 ring-background" title={post.clientOrgName}>
              <AvatarImage
                src={clientLogoUrl ?? ""}
                alt={post.clientOrgName}
              />
              <AvatarFallback className="text-[8px] font-bold bg-info/15 text-info">
                {post.clientOrgName.trim()[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          {post.orgProject?.name?.trim() && (
            <Avatar className="size-5 shrink-0 ring-1 ring-background" title={post.orgProject.name}>
              <AvatarImage src={post.orgProject.avatar ?? ""} alt={post.orgProject.name} />
              <AvatarFallback className="text-[8px] font-bold bg-info/15 text-info">
                {post.orgProject.name.trim()[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          {post.createdBy && (
            <Avatar className="size-5 shrink-0 ring-1 ring-background ml-auto" title={post.createdBy.name}>
              <AvatarImage src={post.createdBy.image ?? ""} alt={post.createdBy.name} />
              <AvatarFallback className="text-[8px] font-bold">
                {post.createdBy.name?.[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        {post.status === "PUBLISHED" && (
          <PostMetricsRow
            reach={post.metricsReach}
            likes={post.metricsLikes}
            comments={post.metricsComments}
            videoViews={post.metricsVideoViews}
          />
        )}
        {(() => {
          if (post.status === "PUBLISHED" && post.publishedAt) {
            return (
              <p className="text-xs text-success flex items-center gap-1">
                <CalendarCheckIcon className="size-3" />
                Publicado {format(new Date(post.publishedAt), "dd/MM HH:mm")}
              </p>
            );
          }
          if (post.scheduledAt) {
            return (
              <p className="text-xs text-info flex items-center gap-1">
                <ClockIcon className="size-3" />
                {format(new Date(post.scheduledAt), "dd/MM HH:mm")}
              </p>
            );
          }
          return (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarIcon className="size-3" />
              {format(new Date(post.createdAt), "dd/MM HH:mm")}
            </p>
          );
        })()}
      </CardContent>
    </Card>
  );
}
