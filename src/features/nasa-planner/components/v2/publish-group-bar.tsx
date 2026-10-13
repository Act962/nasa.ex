"use client";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useSetPlannerGroupDetached, type PublishGroupPost } from "../../hooks/use-planner-publish-group";
import { POST_STATUS_META, instagramAccountsOf } from "./planner-v2-utils";
import type { PlannerClient } from "./planner-v2-types";

/** Contas do grupo no criador (spec 0074, RF-5 e RF-15): status de cada uma, troca de conta e "diferente nesta conta". */

export function accountHandleOf(client: PlannerClient | undefined, instagramAccountId: string | null) {
  const account = instagramAccountsOf(client).find((candidate) => candidate.igUserId === instagramAccountId);
  return `@${account?.igUsername ?? instagramAccountId ?? "conta"}`;
}

export function PublishGroupBar({
  groupPosts,
  openPostId,
  client,
  canEdit,
  onOpenPost,
  onDeleteGroup,
}: {
  groupPosts: PublishGroupPost[];
  openPostId: string;
  client: PlannerClient | undefined;
  canEdit: boolean;
  onOpenPost: (postId: string) => void;
  onDeleteGroup: () => void;
}) {
  const setDetached = useSetPlannerGroupDetached();
  const openPost = groupPosts.find((groupPost) => groupPost.id === openPostId);
  if (!openPost) return null;
  const isOpenPostLocked = openPost.status === "PUBLISHED" || openPost.status === "PUBLISHING";
  const openPostHandle = accountHandleOf(client, openPost.targetIgAccountId);

  return (
    <div className="flex flex-col gap-2 border-b border-line px-4 py-3" data-guide={GUIDE_ANCHORS.plannerComposerGroupAccounts.id}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">Este conteúdo sai em {groupPosts.length} contas:</span>
        {groupPosts.map((groupPost) => {
          const statusMeta = POST_STATUS_META[groupPost.status];
          const isOpen = groupPost.id === openPostId;
          return (
            <button
              key={groupPost.id}
              type="button"
              onClick={() => onOpenPost(groupPost.id)}
              title={groupPost.publishError ?? statusMeta.label}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition",
                isOpen ? "bg-foreground font-semibold text-background" : "bg-panel hover:bg-knob/60",
              )}
            >
              <span className={cn("size-1.5 rounded-full", statusMeta.dotClassName)} />
              {accountHandleOf(client, groupPost.targetIgAccountId)}
              <span className={cn("text-[10px]", isOpen ? "opacity-70" : "text-muted-foreground")}>{statusMeta.label}</span>
              {groupPost.isGroupContentDetached && <span className="text-[10px] text-warning">diferente</span>}
            </button>
          );
        })}
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className={cn("flex items-center gap-2 text-xs", isOpenPostLocked && "opacity-50")}>
            <Switch
              checked={openPost.isGroupContentDetached}
              disabled={isOpenPostLocked || setDetached.isPending}
              onCheckedChange={(isDetached) =>
                setDetached.mutate(
                  { postId: openPost.id, isDetached },
                  {
                    onSuccess: () => toast.success(isDetached ? `${openPostHandle} agora tem conteúdo próprio.` : `${openPostHandle} voltou a seguir o conteúdo do grupo.`),
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            />
            <span>
              Conteúdo diferente em {openPostHandle}
              <span className="block text-[11px] text-muted-foreground">
                {openPost.isGroupContentDetached ? "O que você mudar aqui fica só nesta conta." : "O que você mudar aqui vale para todas as contas."}
              </span>
            </span>
          </label>
          <button type="button" onClick={onDeleteGroup} className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline">
            Excluir em todas as contas
          </button>
        </div>
      )}
    </div>
  );
}
