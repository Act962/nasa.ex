"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useNasaPosts,
  useCreateNasaPost,
  useDeleteNasaPost,
  useGenerateNasaPost,
  useApproveNasaPost,
  useScheduleNasaPost,
  useUpdateNasaPost,
  useNasaPostBrandConfig,
  useUpsertBrandConfig,
} from "../hooks/use-nasa-post";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  PlusIcon,
  SparklesIcon,
  CalendarIcon,
  SettingsIcon,
  CheckCircle2Icon,
  ClockIcon,
  SendIcon,
  TrashIcon,
  MoreVerticalIcon,
  ImageIcon,
  LayoutTemplateIcon,
  FilmIcon,
  Square,
  ChevronLeftIcon,
  ChevronRightIcon,
  StarIcon,
  PaletteIcon,
  TypeIcon,
  HashIcon,
  MegaphoneIcon,
  GlobeIcon,
  AlertCircleIcon,
  XIcon,
  XCircleIcon,
  ColumnsIcon,
  KeyIcon,
  EyeIcon,
  EyeOffIcon,
  CheckIcon,
  SmartphoneIcon,
  HeartIcon,
  MessageCircleIcon,
  BookmarkIcon,
  ShareIcon,
  RefreshCwIcon,
  ArrowRightIcon,
} from "lucide-react";
import { toast } from "sonner";
import { NasaPostStatus, NasaPostType } from "@/generated/prisma/enums";
import { StarsWidget } from "@/features/stars";

// Lazy wrapper to avoid SSR issues
function StarsWidgetNasaPost() { return <StarsWidget />; }
import { useConstructUrl } from "@/hooks/use-construct-url";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, getDay, parse, startOfWeek, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

dayjs.locale("pt-br");

// ─── Localizer ────────────────────────────────────────────────────────────────

const locales = { "pt-BR": ptBR };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// ─── Types ────────────────────────────────────────────────────────────────────

interface Post {
  id: string;
  type: NasaPostType;
  status: NasaPostStatus;
  title: string | null;
  caption: string | null;
  hashtags: string[];
  cta: string | null;
  thumbnail: string | null;
  targetNetworks: string[];
  scheduledAt: string | Date | null;
  aiPrompt: string | null;
  starsSpent: number;
  slides: Array<{
    id: string;
    order: number;
    imageKey: string | null;
    headline: string | null;
    subtext: string | null;
  }>;
  createdBy: { name: string; image: string | null };
  createdAt: string | Date;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  NasaPostStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  DRAFT: {
    label: "Rascunho",
    color: "bg-slate-100 text-slate-600 border-slate-200",
    icon: <Square className="size-3" />,
  },
  PENDING_APPROVAL: {
    label: "Aguardando aprovação",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: <ClockIcon className="size-3" />,
  },
  APPROVED: {
    label: "Aprovado",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: <CheckCircle2Icon className="size-3" />,
  },
  SCHEDULED: {
    label: "Agendado",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: <CalendarIcon className="size-3" />,
  },
  PUBLISHED: {
    label: "Publicado",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    icon: <SendIcon className="size-3" />,
  },
  FAILED: {
    label: "Falhou",
    color: "bg-red-100 text-red-700 border-red-200",
    icon: <AlertCircleIcon className="size-3" />,
  },
};

const TYPE_CONFIG: Record<NasaPostType, { label: string; icon: React.ReactNode }> = {
  STATIC: { label: "Post Estático", icon: <ImageIcon className="size-3.5" /> },
  CAROUSEL: { label: "Carrossel", icon: <LayoutTemplateIcon className="size-3.5" /> },
  REEL: { label: "Reel", icon: <FilmIcon className="size-3.5" /> },
  STORY: { label: "Story", icon: <Square className="size-3.5" /> },
};

const NETWORKS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "tiktok", label: "TikTok" },
];

const KANBAN_COLUMNS: NasaPostStatus[] = [
  NasaPostStatus.DRAFT,
  NasaPostStatus.PENDING_APPROVAL,
  NasaPostStatus.APPROVED,
  NasaPostStatus.SCHEDULED,
  NasaPostStatus.PUBLISHED,
];

// ─── Slide Preview ────────────────────────────────────────────────────────────

function SlidePreview({
  slide,
  brandColors,
  isActive,
}: {
  slide: Post["slides"][0];
  brandColors?: string[];
  isActive?: boolean;
}) {
  const imageUrl = useConstructUrl(slide.imageKey ?? "");
  const bg = brandColors?.[0] ?? "#7C3AED";
  const secondary = brandColors?.[1] ?? "#A78BFA";

  return (
    <div
      className={cn(
        "relative w-full aspect-square rounded-xl overflow-hidden flex flex-col items-center justify-center",
        isActive && "ring-2 ring-primary",
      )}
      style={{
        background: slide.imageKey
          ? undefined
          : `linear-gradient(135deg, ${bg}, ${secondary})`,
      }}
    >
      {slide.imageKey ? (
        <img
          src={imageUrl}
          alt={slide.headline ?? "slide"}
          className="w-full h-full object-cover"
        />
      ) : null}
      {/* Overlay text */}
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center px-6 text-center",
          slide.imageKey && "bg-black/40",
        )}
      >
        {slide.headline && (
          <p className="text-white font-bold text-lg leading-tight drop-shadow-lg">
            {slide.headline}
          </p>
        )}
        {slide.subtext && (
          <p className="text-white/90 text-sm mt-2 leading-snug drop-shadow">
            {slide.subtext}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Phone Mockup ─────────────────────────────────────────────────────────────

const NETWORK_THEMES: Record<string, { name: string; headerBg: string; actionIcons: boolean; username: string }> = {
  instagram: { name: "Instagram", headerBg: "bg-black", actionIcons: true, username: "@suamarca" },
  facebook:  { name: "Facebook",  headerBg: "bg-[#1877F2]", actionIcons: false, username: "Sua Marca" },
  linkedin:  { name: "LinkedIn",  headerBg: "bg-[#0A66C2]", actionIcons: false, username: "Sua Marca" },
  tiktok:    { name: "TikTok",    headerBg: "bg-black", actionIcons: true, username: "@suamarca" },
};

function PhoneMockup({
  slides,
  activeSlide,
  setActiveSlide,
  post,
  brandColors,
  network,
}: {
  slides: Post["slides"];
  activeSlide: number;
  setActiveSlide: (i: number) => void;
  post: Post;
  brandColors?: string[];
  network: string;
}) {
  const theme = NETWORK_THEMES[network] ?? NETWORK_THEMES.instagram;

  return (
    <div className="relative w-full mx-auto" style={{ maxWidth: 375 }}>
      {/* Phone frame */}
      <div className="rounded-[2.5rem] border-[3px] border-slate-800 dark:border-slate-600 bg-black overflow-hidden shadow-2xl">
        {/* Status bar */}
        <div className="flex items-center justify-between px-7 pt-3 pb-1 bg-black text-white text-[10px]">
          <span className="font-semibold">9:41</span>
          <div className="w-24 h-6 bg-black rounded-full" />
          <div className="flex items-center gap-1">
            <span>5G</span>
            <div className="w-4 h-2 border border-white rounded-sm"><div className="h-full w-3/4 bg-white rounded-sm" /></div>
          </div>
        </div>

        {/* App header */}
        <div className={cn("flex items-center justify-between px-4 py-2.5", theme.headerBg)}>
          <span className="text-white text-sm font-bold">{theme.name}</span>
          <div className="flex items-center gap-3">
            <HeartIcon className="size-5 text-white" />
            <SendIcon className="size-5 text-white -rotate-12" />
          </div>
        </div>

        {/* Post content area — white bg simulating feed */}
        <div className="bg-white dark:bg-neutral-950">
          {/* User header */}
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <div className="size-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-[2px]">
              <div className="size-full rounded-full bg-white dark:bg-neutral-950 flex items-center justify-center">
                <div className="size-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-black dark:text-white truncate">{theme.username}</p>
            </div>
            <MoreVerticalIcon className="size-4 text-black dark:text-white" />
          </div>

          {/* Image / Carousel area */}
          <div className="relative bg-slate-100 dark:bg-neutral-900" style={{ aspectRatio: "1/1" }}>
            <SlidePreview
              slide={slides[activeSlide] ?? slides[0]}
              brandColors={brandColors}
              isActive
            />
            {/* Carousel arrows */}
            {slides.length > 1 && (
              <>
                {activeSlide > 0 && (
                  <button
                    onClick={() => setActiveSlide(activeSlide - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-black/60 backdrop-blur-sm rounded-full size-7 flex items-center justify-center shadow-lg"
                  >
                    <ChevronLeftIcon className="size-4 text-black dark:text-white" />
                  </button>
                )}
                {activeSlide < slides.length - 1 && (
                  <button
                    onClick={() => setActiveSlide(activeSlide + 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-black/60 backdrop-blur-sm rounded-full size-7 flex items-center justify-center shadow-lg"
                  >
                    <ChevronRightIcon className="size-4 text-black dark:text-white" />
                  </button>
                )}
                {/* Carousel counter pill */}
                <div className="absolute top-3 right-3 bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  {activeSlide + 1}/{slides.length}
                </div>
                {/* Dots */}
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveSlide(i)}
                      className={cn(
                        "rounded-full transition-all",
                        i === activeSlide ? "bg-blue-500 size-1.5" : "bg-white/60 size-1.5",
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Action icons row */}
          {theme.actionIcons && (
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-4">
                <HeartIcon className="size-6 text-black dark:text-white" />
                <MessageCircleIcon className="size-6 text-black dark:text-white -scale-x-100" />
                <SendIcon className="size-6 text-black dark:text-white -rotate-12" />
              </div>
              {slides.length > 1 && (
                <div className="flex gap-1">
                  {slides.map((_, i) => (
                    <div key={i} className={cn("size-1.5 rounded-full", i === activeSlide ? "bg-blue-500" : "bg-slate-300 dark:bg-neutral-600")} />
                  ))}
                </div>
              )}
              <BookmarkIcon className="size-6 text-black dark:text-white" />
            </div>
          )}

          {/* Caption area */}
          <div className="px-3 pb-3 space-y-1">
            <p className="text-xs text-black dark:text-white">
              <span className="font-semibold">{theme.username} </span>
              <span className="whitespace-pre-wrap">{(post.caption ?? "").slice(0, 150)}{(post.caption ?? "").length > 150 ? "…" : ""}</span>
            </p>
            {post.hashtags.length > 0 && (
              <p className="text-[11px] text-blue-500">
                {post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
              </p>
            )}
            {post.cta && (
              <p className="text-[11px] font-semibold text-black dark:text-white mt-1">
                {post.cta}
              </p>
            )}
          </div>
        </div>

        {/* Bottom safe area */}
        <div className="bg-black h-5 flex justify-center items-end pb-1">
          <div className="w-28 h-1 bg-white/30 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ─── Post Preview Modal (Full Screen) ────────────────────────────────────────

function PostPreviewModal({
  post,
  open,
  onClose,
  onApprove,
  onReject,
  onSchedule,
  onChangeStatus,
  brandColors,
}: {
  post: Post;
  open: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSchedule: (id: string, date: string) => void;
  onChangeStatus: (id: string, status: NasaPostStatus) => void;
  brandColors?: string[];
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [showApproveFlow, setShowApproveFlow] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const approving = useApproveNasaPost();
  const scheduling = useScheduleNasaPost();

  const slides = post.slides.length > 0 ? post.slides : [{ id: "empty", order: 1, imageKey: null, headline: post.title ?? "Post", subtext: post.caption }];
  const primaryNetwork = post.targetNetworks[0] ?? "instagram";

  const canApproveReject = post.status === NasaPostStatus.PENDING_APPROVAL || post.status === NasaPostStatus.DRAFT;
  const canSchedule = post.status === NasaPostStatus.APPROVED;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/*
        Override base DialogContent defaults:
        - sm:!max-w-none removes the sm:max-w-lg (512px) cap
        - !flex !flex-col overrides the default `grid` display
        - !p-0 removes default p-6 padding
        - !gap-0 removes default gap-4
      */}
      <DialogContent
        showCloseButton={false}
        className="!flex !flex-col !p-0 !gap-0 !rounded-2xl sm:!max-w-none !max-w-none w-[min(90vw,1400px)] h-[min(90vh,900px)] overflow-hidden bg-background"
      >
        <DialogTitle className="sr-only">{post.title ?? "Preview do Post"}</DialogTitle>

        {/* ── Header ── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-background shrink-0 min-w-0">
          {/* Left: title + status */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="shrink-0">{TYPE_CONFIG[post.type].icon}</div>
            <span className="font-semibold text-sm truncate hidden sm:block max-w-[180px]">
              {post.title ?? "Preview do Post"}
            </span>
            {/* Status dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity shrink-0",
                  STATUS_CONFIG[post.status].color,
                )}>
                  {STATUS_CONFIG[post.status].icon}
                  <span className="hidden sm:inline">{STATUS_CONFIG[post.status].label}</span>
                  <ChevronRightIcon className="size-3 rotate-90" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {KANBAN_COLUMNS.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => onChangeStatus(post.id, s)}
                    className={cn("gap-2", s === post.status && "font-bold")}
                  >
                    {STATUS_CONFIG[s].icon}
                    {STATUS_CONFIG[s].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg">
              <StarIcon className="size-3 text-yellow-500" />
              {post.starsSpent}★
            </span>

            {canApproveReject && (
              <>
                <Button size="sm" variant="destructive" onClick={() => onReject(post.id)} className="gap-1 h-7 px-2.5">
                  <XCircleIcon className="size-3.5" />
                  <span className="hidden sm:inline">Recusar</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowApproveFlow(true)}
                  disabled={approving.isPending}
                  className="gap-1 h-7 px-2.5 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white border-none"
                >
                  <CheckCircle2Icon className="size-3.5" />
                  <span className="hidden sm:inline">Aprovar</span>
                  <span className="text-[10px] opacity-75 hidden md:inline">(-2★)</span>
                </Button>
              </>
            )}

            {canSchedule && (
              <Button size="sm" variant="outline" onClick={() => setShowApproveFlow(true)} className="gap-1 h-7 px-2.5">
                <CalendarIcon className="size-3.5" />
                <span className="hidden sm:inline">Agendar</span>
              </Button>
            )}

            <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0">
              <XIcon className="size-4" />
            </Button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left column: phone mockup */}
          <div className="flex-1 min-w-0 flex flex-col items-center justify-start bg-slate-50 dark:bg-slate-900/50 overflow-y-auto py-6 px-4">
            {/* Network tabs */}
            {post.targetNetworks.length > 1 && (
              <div className="flex gap-1.5 mb-4">
                {post.targetNetworks.map((n) => (
                  <button
                    key={n}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                      n === primaryNetwork
                        ? "bg-foreground text-background border-foreground"
                        : "border-border hover:border-foreground/40",
                    )}
                  >
                    {NETWORKS.find((x) => x.id === n)?.label ?? n}
                  </button>
                ))}
              </div>
            )}

            {/* Phone mockup — contained to available width */}
            <div className="w-full flex justify-center overflow-hidden">
              <div className="w-full max-w-[375px]">
                <PhoneMockup
                  slides={slides}
                  activeSlide={activeSlide}
                  setActiveSlide={setActiveSlide}
                  post={post}
                  brandColors={brandColors}
                  network={primaryNetwork}
                />
              </div>
            </div>

            {/* Slide thumbnails */}
            {slides.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 mt-4">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSlide(i)}
                    className={cn(
                      "shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all",
                      i === activeSlide ? "border-primary" : "border-transparent hover:border-primary/40",
                    )}
                  >
                    <SlidePreview slide={s} brandColors={brandColors} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right column: details */}
          <div className="w-72 lg:w-80 xl:w-96 shrink-0 border-l flex flex-col overflow-y-auto bg-background">
            <div className="p-4 space-y-4">

              {/* Type & networks */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs font-medium bg-muted/60 px-2.5 py-1 rounded-lg">
                  {TYPE_CONFIG[post.type].icon}
                  {TYPE_CONFIG[post.type].label}
                </span>
                {post.targetNetworks.map((n) => (
                  <span key={n} className="text-xs bg-muted/60 px-2 py-1 rounded-lg">
                    {NETWORKS.find((x) => x.id === n)?.label ?? n}
                  </span>
                ))}
              </div>

              {/* Caption */}
              {post.caption && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Legenda</p>
                  <div className="bg-muted/30 rounded-xl p-3 max-h-40 overflow-y-auto">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.caption}</p>
                  </div>
                </div>
              )}

              {/* Hashtags */}
              {post.hashtags.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <HashIcon className="size-3" /> Hashtags
                  </p>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {post.hashtags.map((h, i) => (
                      <span key={i} className="text-xs text-blue-500 bg-blue-50 dark:bg-blue-950/30 rounded px-1.5 py-0.5">
                        #{h.replace(/^#/, "")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              {post.cta && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <MegaphoneIcon className="size-3" /> CTA
                  </p>
                  <p className="text-sm font-medium text-primary bg-primary/5 rounded-lg px-3 py-2">{post.cta}</p>
                </div>
              )}

              {/* Scheduling */}
              {post.scheduledAt && (
                <div className="flex items-center gap-2 text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/20 rounded-lg px-3 py-2.5">
                  <CalendarIcon className="size-4" />
                  {dayjs(post.scheduledAt).format("DD/MM/YYYY [às] HH:mm")}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Approve / Schedule overlay ── */}
        {showApproveFlow && (
          <div className="absolute inset-0 bg-background/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-2xl border shadow-2xl p-6 w-full max-w-sm space-y-5">
              <div className="text-center">
                <div className="size-12 mx-auto rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mb-3">
                  <CheckCircle2Icon className="size-6 text-green-600" />
                </div>
                <h3 className="font-bold text-lg">
                  {canApproveReject ? "Aprovar e publicar" : "Publicar post aprovado"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {canApproveReject
                    ? "O post será aprovado (-2★). Escolha quando publicar."
                    : "Escolha quando publicar."}
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Agendar para</label>
                  <Input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="text-sm"
                    min={dayjs().format("YYYY-MM-DDTHH:mm")}
                  />
                </div>

                <Button
                  className="w-full gap-1"
                  disabled={!scheduleDate || scheduling.isPending || approving.isPending}
                  onClick={() => {
                    if (canApproveReject) onApprove(post.id);
                    onSchedule(post.id, new Date(scheduleDate).toISOString());
                    setShowApproveFlow(false);
                  }}
                >
                  <CalendarIcon className="size-3.5" />
                  {canApproveReject ? "Aprovar e Agendar" : "Agendar publicação"}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-background px-2 text-muted-foreground">ou</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full gap-1"
                  disabled={approving.isPending}
                  onClick={() => {
                    if (canApproveReject) onApprove(post.id);
                    setShowApproveFlow(false);
                  }}
                >
                  <SendIcon className="size-3.5" />
                  {canApproveReject ? "Aprovar sem agendar" : "Fechar"}
                </Button>
              </div>

              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => { setShowApproveFlow(false); setScheduleDate(""); }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Post Wizard ───────────────────────────────────────────────────────

function CreatePostWizard({
  open,
  onClose,
  rejectPostId,
  rejectPrompt,
}: {
  open: boolean;
  onClose: () => void;
  /** When rejecting a post, pass its ID to re-generate instead of creating new */
  rejectPostId?: string | null;
  /** Pre-fill the prompt textarea when rejecting */
  rejectPrompt?: string | null;
}) {
  const [step, setStep] = useState<"setup" | "generate">("setup");
  const [type, setType] = useState<NasaPostType>(NasaPostType.STATIC);
  const [networks, setNetworks] = useState<string[]>(["instagram"]);
  const [userPrompt, setUserPrompt] = useState("");
  const [createdPostId, setCreatedPostId] = useState<string | null>(null);

  const createPost = useCreateNasaPost();
  const generatePost = useGenerateNasaPost();

  // When opened with a rejected post, skip to generate step
  useEffect(() => {
    if (open && rejectPostId) {
      setCreatedPostId(rejectPostId);
      setUserPrompt(rejectPrompt ?? "");
      setStep("generate");
    }
  }, [open, rejectPostId, rejectPrompt]);

  const handleCreate = async () => {
    try {
      const result = await createPost.mutateAsync({
        type,
        targetNetworks: networks,
        title: `Post ${TYPE_CONFIG[type].label} — ${dayjs().format("DD/MM/YYYY")}`,
      });
      setCreatedPostId(result.post.id);
      setStep("generate");
    } catch {
      // erro já exibido via toast no hook useCreateNasaPost
    }
  };

  const handleGenerate = async () => {
    if (!createdPostId || !userPrompt.trim()) return;
    try {
      await generatePost.mutateAsync({
        postId: createdPostId,
        userPrompt,
        networks,
      });
      onClose();
      resetState();
    } catch {
      // erro já exibido via toast no hook useGenerateNasaPost
    }
  };

  const resetState = () => {
    setStep("setup");
    setType(NasaPostType.STATIC);
    setNetworks(["instagram"]);
    setUserPrompt("");
    setCreatedPostId(null);
  };

  const toggleNetwork = (id: string) =>
    setNetworks((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id],
    );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); resetState(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-purple-500" />
            {step === "setup" ? "Novo Post" : "Gerar com IA"}
          </DialogTitle>
        </DialogHeader>

        {step === "setup" ? (
          <div className="space-y-5">
            {/* Type selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de conteúdo</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(TYPE_CONFIG) as NasaPostType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-all",
                      type === t
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/40 hover:bg-muted/40",
                    )}
                  >
                    {TYPE_CONFIG[t].icon}
                    {TYPE_CONFIG[t].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Networks */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <GlobeIcon className="size-3.5" /> Redes sociais
              </label>
              <div className="flex flex-wrap gap-2">
                {NETWORKS.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => toggleNetwork(n.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      networks.includes(n.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => { onClose(); resetState(); }}>Cancelar</Button>
              <Button
                onClick={handleCreate}
                disabled={createPost.isPending || networks.length === 0}
              >
                Continuar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-purple-50 dark:bg-purple-950/20 rounded-xl p-4 text-sm space-y-1">
              <p className="font-medium text-purple-700 dark:text-purple-300 flex items-center gap-1">
                <SparklesIcon className="size-3.5" /> Claude IA vai criar seu post
              </p>
              <p className="text-purple-600/70 dark:text-purple-400/70 text-xs">
                A IA usará a identidade visual da sua marca para gerar o conteúdo.
                Custo: <strong>5★</strong> por geração.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">O que você quer comunicar?</label>
              <Textarea
                placeholder="Ex: Lançamento do produto X, promoção de 20% para clientes novos, dica sobre Y para o nosso público..."
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Seja específico. A IA criará legenda, hashtags, CTA e estrutura visual.
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setStep("setup")}>
                Voltar
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!userPrompt.trim() || generatePost.isPending}
                className="gap-1"
              >
                <SparklesIcon className="size-3.5" />
                {generatePost.isPending ? "Gerando..." : "Gerar com IA"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Logo Uploader ────────────────────────────────────────────────────────────

function LogoUploader({
  label,
  hint,
  bg,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  bg: string;
  value: string;
  onChange: (key: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const s3Url = useConstructUrl(value);
  const hasLogo = !!value;

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são permitidas");
      return;
    }
    setUploading(true);
    try {
      const res = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          isImage: true,
        }),
      });
      const { presignedUrl, key } = await res.json();
      await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      onChange(key);
      toast.success("Logo enviada!");
    } catch {
      toast.error("Erro ao enviar logo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium">{label}</label>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
      <div
        className={cn(
          "relative h-20 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors overflow-hidden",
          bg,
          uploading ? "opacity-60 cursor-not-allowed" : "hover:border-primary/60",
        )}
        onClick={() => !uploading && fileRef.current?.click()}
      >
        {hasLogo ? (
          <>
            <img src={s3Url} alt={label} className="max-h-14 max-w-full object-contain" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <XIcon className="size-3" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            {uploading ? (
              <span className="text-xs">Enviando…</span>
            ) : (
              <>
                <ImageIcon className="size-5 opacity-40" />
                <span className="text-[10px]">Clique para enviar</span>
              </>
            )}
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/svg+xml,image/webp,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── Brand Config Modal ───────────────────────────────────────────────────────

function BrandConfigModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { config, isLoading } = useNasaPostBrandConfig();
  const upsert = useUpsertBrandConfig();

  const [brandName, setBrandName] = useState("");
  const [brandSlogan, setBrandSlogan] = useState("");
  const [website, setWebsite] = useState("");
  const [icp, setIcp] = useState("");
  const [toneOfVoice, setToneOfVoice] = useState("");
  const [positioning, setPositioning] = useState("");
  const [primaryColors, setPrimaryColors] = useState("");
  const [secondaryColors, setSecondaryColors] = useState("");
  const [defaultHashtags, setDefaultHashtags] = useState("");
  const [defaultCtas, setDefaultCtas] = useState("");
  const [keyMessages, setKeyMessages] = useState("");
  const [forbiddenWords, setForbiddenWords] = useState("");
  const [swotStrengths, setSwotStrengths] = useState("");
  const [swotWeaknesses, setSwotWeaknesses] = useState("");
  const [swotOpportunities, setSwotOpportunities] = useState("");
  const [swotThreats, setSwotThreats] = useState("");
  const [fontHeading, setFontHeading] = useState("");
  const [fontBody, setFontBody] = useState("");
  const [logoLight, setLogoLight] = useState("");
  const [logoDark, setLogoDark] = useState("");
  const [logoSquare, setLogoSquare] = useState("");
  const [logoHorizontal, setLogoHorizontal] = useState("");
  const [showBranding, setShowBranding] = useState(true);
  // IA tab
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  // ── Populate form when modal opens or config loads ──────────────────────────
  useEffect(() => {
    if (!open) return;
    const swot = config?.swot as Record<string, string> | null;
    const fonts = config?.fonts as Record<string, string> | null;
    setBrandName(config?.brandName ?? "");
    setBrandSlogan(config?.brandSlogan ?? "");
    setWebsite(config?.website ?? "");
    setIcp(config?.icp ?? "");
    setToneOfVoice(config?.toneOfVoice ?? "");
    setPositioning(config?.positioning ?? "");
    setPrimaryColors((config?.primaryColors ?? []).join(", "));
    setSecondaryColors((config?.secondaryColors ?? []).join(", "));
    setDefaultHashtags((config?.defaultHashtags ?? []).join(", "));
    setDefaultCtas((config?.defaultCtas ?? []).join(" | "));
    setKeyMessages((config?.keyMessages ?? []).join("\n"));
    setForbiddenWords((config?.forbiddenWords ?? []).join(", "));
    setSwotStrengths(swot?.strengths ?? "");
    setSwotWeaknesses(swot?.weaknesses ?? "");
    setSwotOpportunities(swot?.opportunities ?? "");
    setSwotThreats(swot?.threats ?? "");
    setFontHeading(fonts?.heading ?? "");
    setFontBody(fonts?.body ?? "");
    setLogoLight(config?.logoLight ?? "");
    setLogoDark(config?.logoDark ?? "");
    setLogoSquare(config?.logoSquare ?? "");
    setLogoHorizontal(config?.logoHorizontal ?? "");
    setShowBranding((config as any)?.showBranding ?? true);
    // Never pre-fill the API key field (it's never sent from server)
    // Just clear it so user knows to re-enter only when changing
    setAnthropicApiKey("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, config?.id]);

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        brandName: brandName.trim() || "Minha Marca",
        brandSlogan: brandSlogan || undefined,
        website: website || undefined,
        icp: icp || undefined,
        toneOfVoice: toneOfVoice || undefined,
        positioning: positioning || undefined,
        primaryColors: primaryColors ? primaryColors.split(",").map((c) => c.trim()).filter(Boolean) : [],
        secondaryColors: secondaryColors ? secondaryColors.split(",").map((c) => c.trim()).filter(Boolean) : [],
        defaultHashtags: defaultHashtags ? defaultHashtags.split(",").map((h) => h.trim()).filter(Boolean) : [],
        defaultCtas: defaultCtas ? defaultCtas.split("|").map((c) => c.trim()).filter(Boolean) : [],
        keyMessages: keyMessages ? keyMessages.split("\n").map((m) => m.trim()).filter(Boolean) : [],
        forbiddenWords: forbiddenWords ? forbiddenWords.split(",").map((w) => w.trim()).filter(Boolean) : [],
        swot: {
          strengths: swotStrengths,
          weaknesses: swotWeaknesses,
          opportunities: swotOpportunities,
          threats: swotThreats,
        },
        fonts: { heading: fontHeading, body: fontBody },
        logoLight: logoLight || undefined,
        logoDark: logoDark || undefined,
        logoSquare: logoSquare || undefined,
        logoHorizontal: logoHorizontal || undefined,
        showBranding,
        ...(anthropicApiKey.trim() ? { anthropicApiKey: anthropicApiKey.trim() } : {}),
      });
      onClose();
    } catch {
      // erro já exibido via toast no hook useUpsertBrandConfig
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PaletteIcon className="size-4" /> Configuração de Marca
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <Tabs defaultValue="brand">
            <TabsList className="grid grid-cols-5 mb-4">
              <TabsTrigger value="brand">Marca</TabsTrigger>
              <TabsTrigger value="voice">Voz & Tom</TabsTrigger>
              <TabsTrigger value="visual">Visual</TabsTrigger>
              <TabsTrigger value="swot">SWOT</TabsTrigger>
              <TabsTrigger value="ia" className="flex items-center gap-1">
                <SparklesIcon className="size-3" />
                IA
              </TabsTrigger>
            </TabsList>

            {/* ── Marca ── */}
            <TabsContent value="brand" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Nome da marca</label>
                  <Input placeholder="Nike, Apple…" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Slogan</label>
                  <Input placeholder="Just Do It" value={brandSlogan} onChange={(e) => setBrandSlogan(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Website</label>
                <Input placeholder="https://suamarca.com.br" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">ICP — Perfil do cliente ideal</label>
                <Textarea
                  placeholder="Descreva seu cliente ideal: idade, profissão, dores, desejos, onde está…"
                  value={icp}
                  onChange={(e) => setIcp(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Posicionamento de mercado</label>
                <Textarea
                  placeholder="Como sua marca se posiciona diante dos concorrentes?"
                  value={positioning}
                  onChange={(e) => setPositioning(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </TabsContent>

            {/* ── Voz & Tom ── */}
            <TabsContent value="voice" className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Tom de voz</label>
                <Textarea
                  placeholder="Ex: Descontraído mas profissional, usa linguagem informal, evita jargões técnicos, próximo e empático…"
                  value={toneOfVoice}
                  onChange={(e) => setToneOfVoice(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Mensagens-chave (uma por linha)</label>
                <Textarea
                  placeholder={"Qualidade premium acessível\nInovação com propósito\nFeito para quem não abre mão do melhor"}
                  value={keyMessages}
                  onChange={(e) => setKeyMessages(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Palavras proibidas (separadas por vírgula)</label>
                <Input
                  placeholder="barato, produto, compre, desconto…"
                  value={forbiddenWords}
                  onChange={(e) => setForbiddenWords(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Hashtags padrão (separadas por vírgula)</label>
                <Input
                  placeholder="#suamarca, #seusegmento, #brasil"
                  value={defaultHashtags}
                  onChange={(e) => setDefaultHashtags(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">CTAs padrão (separados por |)</label>
                <Input
                  placeholder="Acesse o link na bio | Fale conosco | Saiba mais"
                  value={defaultCtas}
                  onChange={(e) => setDefaultCtas(e.target.value)}
                />
              </div>
            </TabsContent>

            {/* ── Visual ── */}
            <TabsContent value="visual" className="space-y-5">

              {/* Toggle post com/sem marca */}
              <div className="flex items-center justify-between rounded-xl border px-4 py-3 bg-muted/20">
                <div>
                  <p className="text-sm font-medium">
                    {showBranding ? "Post com marca" : "Post sem marca"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {showBranding
                      ? "A logo será incluída nos posts gerados pela IA"
                      : "Posts serão gerados sem aplicar a logo da marca"}
                  </p>
                </div>
                <Switch checked={showBranding} onCheckedChange={setShowBranding} />
              </div>

              {/* Logos */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Logos da marca (.PNG com fundo transparente recomendado)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <LogoUploader
                    label="Logo — fundo claro"
                    hint="Para posts com fundo branco ou claro"
                    bg="border-slate-300 bg-white"
                    value={logoLight}
                    onChange={setLogoLight}
                  />
                  <LogoUploader
                    label="Logo — fundo escuro"
                    hint="Para posts com fundo escuro ou colorido"
                    bg="border-slate-600 bg-slate-900"
                    value={logoDark}
                    onChange={setLogoDark}
                  />
                  <LogoUploader
                    label="Logo quadrada (ícone / avatar)"
                    hint="Versão compacta, símbolo ou ícone da marca"
                    bg="border-purple-300 bg-purple-50"
                    value={logoSquare}
                    onChange={setLogoSquare}
                  />
                  <LogoUploader
                    label="Logo horizontal (assinatura)"
                    hint="Versão horizontal com nome da marca"
                    bg="border-pink-300 bg-pink-50"
                    value={logoHorizontal}
                    onChange={setLogoHorizontal}
                  />
                </div>
              </div>

              {/* Colors */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1">
                  <PaletteIcon className="size-3" /> Cores primárias (hex, separadas por vírgula)
                </label>
                <Input
                  placeholder="#7C3AED, #5B21B6"
                  value={primaryColors}
                  onChange={(e) => setPrimaryColors(e.target.value)}
                />
                {primaryColors && (
                  <div className="flex gap-2 flex-wrap">
                    {primaryColors.split(",").map((c, i) => (
                      <div key={i} className="size-7 rounded-full border shadow-sm" style={{ backgroundColor: c.trim() }} title={c.trim()} />
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Cores secundárias (hex, separadas por vírgula)</label>
                <Input
                  placeholder="#A78BFA, #DDD6FE"
                  value={secondaryColors}
                  onChange={(e) => setSecondaryColors(e.target.value)}
                />
                {secondaryColors && (
                  <div className="flex gap-2 flex-wrap">
                    {secondaryColors.split(",").map((c, i) => (
                      <div key={i} className="size-7 rounded-full border shadow-sm" style={{ backgroundColor: c.trim() }} title={c.trim()} />
                    ))}
                  </div>
                )}
              </div>

              {/* Fonts */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium flex items-center gap-1">
                    <TypeIcon className="size-3" /> Fonte títulos
                  </label>
                  <Input placeholder="Montserrat Bold" value={fontHeading} onChange={(e) => setFontHeading(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Fonte corpo</label>
                  <Input placeholder="Inter Regular" value={fontBody} onChange={(e) => setFontBody(e.target.value)} />
                </div>
              </div>
            </TabsContent>

            {/* ── SWOT ── */}
            <TabsContent value="swot" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-green-600">💪 Forças</label>
                  <Textarea placeholder="Pontos fortes da marca…" value={swotStrengths} onChange={(e) => setSwotStrengths(e.target.value)} rows={4} className="resize-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-red-500">⚠️ Fraquezas</label>
                  <Textarea placeholder="Pontos a melhorar…" value={swotWeaknesses} onChange={(e) => setSwotWeaknesses(e.target.value)} rows={4} className="resize-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-blue-600">🚀 Oportunidades</label>
                  <Textarea placeholder="Oportunidades de mercado…" value={swotOpportunities} onChange={(e) => setSwotOpportunities(e.target.value)} rows={4} className="resize-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-orange-500">🌪️ Ameaças</label>
                  <Textarea placeholder="Ameaças externas…" value={swotThreats} onChange={(e) => setSwotThreats(e.target.value)} rows={4} className="resize-none" />
                </div>
              </div>
            </TabsContent>

            {/* ── IA & API Keys ── */}
            <TabsContent value="ia" className="space-y-5">
              {/* Info banner */}
              <div className="flex gap-3 rounded-xl border border-purple-200 bg-purple-50 dark:border-purple-800/40 dark:bg-purple-950/20 p-4">
                <SparklesIcon className="size-5 text-purple-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                    Claude IA — Geração de conteúdo
                  </p>
                  <p className="text-xs text-purple-600/80 dark:text-purple-400/80 leading-relaxed">
                    O NASA Post usa o Claude da Anthropic para criar legendas, hashtags, CTAs e estrutura de slides.
                    Insira sua chave de API para habilitar as gerações. Cada criação consome <strong>5★</strong> e cada aprovação <strong>2★</strong>.
                  </p>
                  <a
                    href="https://console.anthropic.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400 underline underline-offset-2 mt-1"
                  >
                    Obter chave em console.anthropic.com/keys
                    <ArrowRightIcon className="size-3" />
                  </a>
                </div>
              </div>

              {/* Key status */}
              {(config as any)?.hasAnthropicKey && !anthropicApiKey && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-950/20 px-3 py-2.5">
                  <CheckIcon className="size-4 text-green-600 shrink-0" />
                  <p className="text-xs text-green-700 dark:text-green-300">
                    Chave Anthropic configurada e ativa. Para substituí-la, digite a nova chave abaixo.
                  </p>
                </div>
              )}

              {/* API Key input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1">
                  <KeyIcon className="size-3" />
                  Chave de API — Anthropic
                </label>
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    placeholder={
                      (config as any)?.hasAnthropicKey
                        ? "••••••••••••••••  (deixe em branco para manter a atual)"
                        : "sk-ant-api03-..."
                    }
                    value={anthropicApiKey}
                    onChange={(e) => setAnthropicApiKey(e.target.value)}
                    className="pr-10 font-mono text-sm"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showApiKey
                      ? <EyeOffIcon className="size-4" />
                      : <EyeIcon className="size-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  A chave é armazenada de forma segura e nunca é exibida novamente. Cada organização tem sua própria chave.
                </p>
              </div>

              {/* Model info */}
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Modelo utilizado</p>
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shrink-0">
                    <SparklesIcon className="size-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">claude-3-5-sonnet-20241022</p>
                    <p className="text-xs text-muted-foreground">Modelo de última geração da Anthropic — alta qualidade criativa</p>
                  </div>
                </div>
              </div>

              {/* Consumption table */}
              <div className="rounded-xl border overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/40 border-b">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Consumo de Stars ★</p>
                </div>
                <div className="divide-y">
                  {[
                    { action: "Gerar post com IA", cost: "5★", icon: <SparklesIcon className="size-3.5 text-purple-500" /> },
                    { action: "Aprovar post", cost: "2★", icon: <CheckCircle2Icon className="size-3.5 text-green-500" /> },
                  ].map(({ action, cost, icon }) => (
                    <div key={action} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        {icon}
                        {action}
                      </div>
                      <span className="text-sm font-bold text-yellow-600">{cost}</span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {!isLoading && (
          <div className="flex gap-2 justify-end pt-2 border-t mt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? "Salvando…" : "Salvar configuração"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  onPreview,
  onDelete,
  brandColors,
  compact,
}: {
  post: Post;
  onPreview: (post: Post) => void;
  onDelete: (id: string) => void;
  brandColors?: string[];
  compact?: boolean;
}) {
  const firstSlide = post.slides[0];
  const thumbnailUrl = useConstructUrl(
    firstSlide?.imageKey ?? post.thumbnail ?? "",
  );
  const bg = brandColors?.[0] ?? "#7C3AED";
  const secondary = brandColors?.[1] ?? "#A78BFA";

  const hasThumbnail = !!(firstSlide?.imageKey ?? post.thumbnail);

  return (
    <div
      className={cn(
        "group relative bg-card border border-border rounded-xl overflow-hidden cursor-pointer",
        "hover:border-primary/40 hover:shadow-md transition-all",
        compact && "rounded-lg",
      )}
      onClick={() => onPreview(post)}
    >
      {/* Visual thumbnail */}
      <div
        className={cn(
          "relative overflow-hidden",
          compact ? "h-24" : "h-36",
          "flex items-center justify-center",
        )}
        style={{
          background: hasThumbnail
            ? undefined
            : `linear-gradient(135deg, ${bg}, ${secondary})`,
        }}
      >
        {hasThumbnail ? (
          <img src={thumbnailUrl} alt={post.title ?? ""} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/90">
            {TYPE_CONFIG[post.type].icon}
            <span className="text-xs font-medium">{TYPE_CONFIG[post.type].label}</span>
            {post.slides.length > 1 && (
              <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded-full">
                {post.slides.length} slides
              </span>
            )}
          </div>
        )}
        {/* Status badge overlay */}
        <div className="absolute top-2 left-2">
          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex items-center gap-0.5", STATUS_CONFIG[post.status].color)}>
            {STATUS_CONFIG[post.status].icon}
            {STATUS_CONFIG[post.status].label}
          </span>
        </div>
        {/* Actions overlay */}
        <div
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 bg-background/90 backdrop-blur rounded-lg border border-border shadow-sm">
                <MoreVerticalIcon className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onPreview(post)}>
                <CheckCircle2Icon className="size-3.5" /> Ver / Aprovar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(post.id)}>
                <TrashIcon className="size-3.5" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Info */}
      {!compact && (
        <div className="px-3 py-2.5">
          <p className="text-xs font-semibold truncate">{post.title ?? TYPE_CONFIG[post.type].label}</p>
          {post.caption && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5 line-clamp-2">
              {post.caption}
            </p>
          )}
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {post.targetNetworks.slice(0, 3).map((n) => (
              <span key={n} className="text-[9px] bg-muted px-1.5 py-0.5 rounded">
                {NETWORKS.find((x) => x.id === n)?.label ?? n}
              </span>
            ))}
            {post.starsSpent > 0 && (
              <span className="text-[9px] text-yellow-600 flex items-center gap-0.5 ml-auto">
                <StarIcon className="size-2.5" />{post.starsSpent}★
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

function KanbanBoard({
  posts,
  onPreview,
  onDelete,
  brandColors,
}: {
  posts: Post[];
  onPreview: (post: Post) => void;
  onDelete: (id: string) => void;
  brandColors?: string[];
}) {
  const byStatus = (status: NasaPostStatus) =>
    posts.filter((p) => p.status === status);

  return (
    <div className="flex gap-4 h-full overflow-x-auto pb-2">
      {KANBAN_COLUMNS.map((status) => {
        const columnPosts = byStatus(status);
        return (
          <div key={status} className="shrink-0 w-64 flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <div className={cn("flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg border", STATUS_CONFIG[status].color)}>
                {STATUS_CONFIG[status].icon}
                {STATUS_CONFIG[status].label}
              </div>
              <span className="text-xs text-muted-foreground bg-muted rounded-full w-5 h-5 flex items-center justify-center">
                {columnPosts.length}
              </span>
            </div>
            <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
              {columnPosts.length === 0 ? (
                <div className="border border-dashed rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground">Nenhum post</p>
                </div>
              ) : (
                columnPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onPreview={onPreview}
                    onDelete={onDelete}
                    brandColors={brandColors}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView({
  posts,
  onPreview,
  brandColors,
}: {
  posts: Post[];
  onPreview: (post: Post) => void;
  brandColors?: string[];
}) {
  const [calDate, setCalDate] = useState(new Date());

  const events = posts
    .filter((p) => p.scheduledAt)
    .map((p) => ({
      id: p.id,
      title: p.title ?? TYPE_CONFIG[p.type].label,
      start: new Date(p.scheduledAt!),
      end: new Date(p.scheduledAt!),
      post: p,
    }));

  return (
    <div className="h-full flex flex-col">
      {/* Custom toolbar */}
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <Button variant="outline" size="icon-sm" onClick={() => setCalDate(subMonths(calDate, 1))}>
          <ChevronLeftIcon className="size-4" />
        </Button>
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 min-w-40 justify-center">
          <CalendarIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium capitalize">
            {dayjs(calDate).format("MMMM YYYY")}
          </span>
        </div>
        <Button variant="outline" size="icon-sm" onClick={() => setCalDate(addMonths(calDate, 1))}>
          <ChevronRightIcon className="size-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCalDate(new Date())}>
          Hoje
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        <Calendar
          localizer={localizer}
          date={calDate}
          events={events}
          views={["month"]}
          defaultView="month"
          culture="pt-BR"
          toolbar={false}
          style={{ height: "100%" }}
          onSelectEvent={(e: any) => onPreview(e.post)}
          messages={{
            noEventsInRange: "Nenhum post agendado neste período",
            showMore: (total) => `+ ${total} mais`,
          }}
          eventPropGetter={() => ({
            style: {
              backgroundColor: brandColors?.[0] ?? "#7C3AED",
              borderColor: "transparent",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 600,
            },
          })}
        />
      </div>
    </div>
  );
}

// ─── Main NASA Post App ───────────────────────────────────────────────────────

export function NasaPostApp() {
  const [view, setView] = useState<"kanban" | "calendar">("kanban");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);

  // Reject flow: reopen wizard with existing post ID & prompt
  const [rejectPostId, setRejectPostId] = useState<string | null>(null);
  const [rejectPrompt, setRejectPrompt] = useState<string | null>(null);

  const { posts, isLoading } = useNasaPosts({
    status: filterStatus !== "all" ? filterStatus : undefined,
    search: search || undefined,
  });
  const { config } = useNasaPostBrandConfig();
  const deletePost = useDeleteNasaPost();
  const approvePost = useApproveNasaPost();
  const schedulePost = useScheduleNasaPost();
  const updatePost = useUpdateNasaPost();

  const brandColors = config?.primaryColors as string[] | undefined;

  const handleApprove = useCallback(
    (id: string) => approvePost.mutate({ postId: id }),
    [approvePost],
  );
  const handleSchedule = useCallback(
    (id: string, date: string) => schedulePost.mutate({ postId: id, scheduledAt: date }),
    [schedulePost],
  );
  const handleReject = useCallback(
    (id: string) => {
      // Find the post to get its prompt
      const post = posts.find((p) => p.id === id);
      // Set back to DRAFT
      updatePost.mutate({ postId: id, status: NasaPostStatus.DRAFT });
      // Close preview and open wizard with post id + prompt prefilled
      setPreviewPost(null);
      setRejectPostId(id);
      setRejectPrompt(post?.aiPrompt ?? "");
      setCreateOpen(true);
    },
    [posts, updatePost],
  );
  const handleChangeStatus = useCallback(
    (id: string, status: NasaPostStatus) => {
      updatePost.mutate({ postId: id, status });
      // Update the preview post in-place so the modal reflects the change
      setPreviewPost((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
    },
    [updatePost],
  );
  const handleDelete = async () => {
    if (!deletePostId) return;
    try {
      await deletePost.mutateAsync({ postId: deletePostId });
      setDeletePostId(null);
    } catch {
      // erro já exibido via toast
    }
  };

  return (
    <div className="flex h-svh min-h-0 overflow-hidden flex-col">
      {/* ── Top Bar ── */}
      <div className="flex items-center gap-3 px-6 py-3 border-b bg-background shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2">
          <div className="size-7 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
            <SparklesIcon className="size-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight">NASA Post</span>
        </div>

        {/* Search */}
        <div className="relative w-44 shrink-0">
          <Input
            placeholder="Buscar posts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-3 h-8 text-sm"
          />
        </div>

        {/* Status filter */}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(STATUS_CONFIG) as NasaPostStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex gap-0.5 border border-border rounded-lg p-0.5">
          <button
            onClick={() => setView("kanban")}
            className={cn("p-1.5 rounded-md transition-colors", view === "kanban" ? "bg-muted" : "hover:bg-muted/50")}
            title="Kanban"
          >
            <ColumnsIcon className="size-3.5" />
          </button>
          <button
            onClick={() => setView("calendar")}
            className={cn("p-1.5 rounded-md transition-colors", view === "calendar" ? "bg-muted" : "hover:bg-muted/50")}
            title="Calendário"
          >
            <CalendarIcon className="size-3.5" />
          </button>
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <StarsWidgetNasaPost />
        <Button size="sm" variant="outline" onClick={() => setBrandOpen(true)}>
          <SettingsIcon className="size-3.5" />
          Marca
        </Button>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="gap-1 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white border-none"
        >
          <SparklesIcon className="size-3.5" />
          Criar Post
        </Button>
      </div>

      {/* ── Stats strip ── */}
      {!isLoading && posts.length > 0 && (
        <div className="flex items-center gap-6 px-6 py-2 border-b bg-muted/20 shrink-0 text-xs text-muted-foreground">
          {(Object.keys(STATUS_CONFIG) as NasaPostStatus[]).map((s) => {
            const count = posts.filter((p) => p.status === s).length;
            if (!count) return null;
            return (
              <span key={s} className={cn("flex items-center gap-1 font-medium", STATUS_CONFIG[s].color.split(" ")[1])}>
                {STATUS_CONFIG[s].icon}
                {count} {STATUS_CONFIG[s].label}
              </span>
            );
          })}
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden px-6 py-4 min-h-0">
        {isLoading ? (
          <div className="flex gap-4 h-full">
            {[1,2,3,4].map((i) => (
              <div key={i} className="w-64 shrink-0 space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 && filterStatus === "all" && !search ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="size-20 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-950/40 dark:to-pink-950/40 flex items-center justify-center mb-5">
              <SparklesIcon className="size-10 text-purple-500" />
            </div>
            <h2 className="text-xl font-bold mb-2">Bem-vindo ao NASA Post</h2>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              Crie posts incríveis para redes sociais com inteligência artificial.
              Configure sua marca e deixe a IA fazer o trabalho pesado.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setBrandOpen(true)}>
                <PaletteIcon className="size-3.5" />
                Configurar marca
              </Button>
              <Button
                onClick={() => setCreateOpen(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white border-none"
              >
                <SparklesIcon className="size-3.5" />
                Criar primeiro post
              </Button>
            </div>
          </div>
        ) : view === "kanban" ? (
          <KanbanBoard
            posts={posts as Post[]}
            onPreview={(p) => setPreviewPost(p as Post)}
            onDelete={setDeletePostId}
            brandColors={brandColors}
          />
        ) : (
          <CalendarView
            posts={posts as Post[]}
            onPreview={(p) => setPreviewPost(p as Post)}
            brandColors={brandColors}
          />
        )}
      </div>

      {/* ── Modals ── */}
      <CreatePostWizard
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setRejectPostId(null);
          setRejectPrompt(null);
        }}
        rejectPostId={rejectPostId}
        rejectPrompt={rejectPrompt}
      />
      <BrandConfigModal open={brandOpen} onClose={() => setBrandOpen(false)} />

      {previewPost && (
        <PostPreviewModal
          post={previewPost}
          open={!!previewPost}
          onClose={() => setPreviewPost(null)}
          onApprove={(id) => {
            handleApprove(id);
            setPreviewPost(null);
          }}
          onReject={(id) => handleReject(id)}
          onSchedule={(id, date) => {
            handleSchedule(id, date);
            setPreviewPost(null);
          }}
          onChangeStatus={(id, status) => handleChangeStatus(id, status)}
          brandColors={brandColors}
        />
      )}

      <AlertDialog open={!!deletePostId} onOpenChange={(o) => !o && setDeletePostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir post?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
