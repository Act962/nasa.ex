"use client";

import { useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import {
  LinkIcon, CheckCircle2Icon, CopyIcon, AlertCircleIcon,
  RocketIcon, FileImageIcon, LayoutGridIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  useNasaPlannerPosts, useNasaPlannerCards, useCreateCalendarShare, useSchedulePlannerPost,
} from "../../hooks/use-nasa-planner";
import { CampaignPlannerWizard } from "../campaign-planner-wizard";
import { useNasaPlanner } from "../../hooks/use-nasa-planner";
import { PostsCalendarMonthGrid } from "../posts-calendar/posts-calendar-month-grid";
import { PostDetailDialog } from "../post-detail-dialog";
import type { MenuAction } from "../posts-calendar/types";

dayjs.locale("pt-br");

type FilterType = "all" | "campaign" | "post";

export function CalendarTab({ plannerId }: { plannerId: string }) {
  const { planner } = useNasaPlanner(plannerId);
  const { posts } = useNasaPlannerPosts(plannerId);
  const createShare = useCreateCalendarShare();
  const schedulePost = useSchedulePlannerPost();

  const [filter, setFilter] = useState<FilterType>("all");
  const [cursor, setCursor] = useState(dayjs().startOf("month"));
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<MenuAction | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [campaignWizardOpen, setCampaignWizardOpen] = useState(false);

  const filteredPosts = posts
    .filter((p) => {
      if (filter === "campaign") return false;
      return p.scheduledAt || p.publishedAt;
    })
    .map((p) => ({
      ...p,
      scheduledAt: p.scheduledAt ? new Date(p.scheduledAt).toISOString() : null,
      publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
    }));

  const handleMenuAction = (postId: string, action: MenuAction) => {
    setSelectedPostId(postId);
    setPendingAction(action);
  };

  const handleReschedule = async (postId: string, newDate: Date) => {
    try {
      await schedulePost.mutateAsync({ postId, scheduledAt: newDate.toISOString() });
    } catch {
      toast.error("Erro ao reagendar post");
    }
  };

  const handleShare = async () => {
    // A procedure devolve só o token e ainda não há página pública que o receba: sem link para montar.
    await createShare.mutateAsync({ plannerId });
    setShareOpen(true);
  };

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 shrink-0 gap-4 flex-wrap">
        <div className="flex items-center gap-1 rounded-full bg-panel p-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 rounded-full text-xs gap-1.5", filter === "all" && "bg-foreground text-background hover:bg-foreground/90 hover:text-background")}
            onClick={() => setFilter("all")}
          >
            <LayoutGridIcon className="size-3.5" />Todos
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 rounded-full text-xs gap-1.5", filter === "post" && "bg-foreground text-background hover:bg-foreground/90 hover:text-background")}
            onClick={() => setFilter("post")}
          >
            <FileImageIcon className="size-3.5" />Posts
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-brand-instagram shrink-0" />Instagram
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-brand-facebook shrink-0" />Facebook
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-foreground shrink-0" />TikTok
            </span>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCampaignWizardOpen(true)}>
            <RocketIcon className="size-3.5" />Campanha
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleShare} disabled={createShare.isPending}>
            <LinkIcon className="size-3.5" />
            {createShare.isPending ? "Gerando..." : "Compartilhar"}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <PostsCalendarMonthGrid
          posts={filteredPosts}
          cursor={cursor}
          onCursorChange={setCursor}
          onSelect={(p) => setSelectedPostId(p.id)}
          onReschedule={handleReschedule}
          selectedId={selectedPostId}
          onMenuAction={handleMenuAction}
        />
      </div>

      <PostDetailDialog
        post={posts.find((p) => p.id === selectedPostId) ?? null}
        plannerId={plannerId}
        open={!!selectedPostId}
        onOpenChange={(o) => { if (!o) setSelectedPostId(null); }}
        initialAction={pendingAction}
        onInitialActionConsumed={() => setPendingAction(null)}
      />

      {/* Campaign Wizard */}
      <CampaignPlannerWizard
        open={campaignWizardOpen}
        onOpenChange={setCampaignWizardOpen}
        plannerId={plannerId}
        plannerClientName={planner?.clientOrgName ?? undefined}
        plannerOrgProjectId={planner?.orgProjectId ?? undefined}
      />

      {/* Share dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Link de Compartilhamento</DialogTitle></DialogHeader>
          {shareUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Compartilhe este link para que outros visualizem o calendário.
              </p>
              <div className="flex items-center gap-2">
                <Input value={shareUrl} readOnly className="text-xs" />
                <Button size="icon" variant="outline" onClick={handleCopy}>
                  {copied ? <CheckCircle2Icon className="size-4" /> : <CopyIcon className="size-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircleIcon className="size-4" />Não foi possível gerar o link.
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShareOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
