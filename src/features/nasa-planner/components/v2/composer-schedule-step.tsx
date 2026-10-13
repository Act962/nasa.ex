"use client";

import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { emitTourResult } from "@/features/tour/store";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { Input } from "@/components/ui/input";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { usePlannerSlots } from "../../hooks/use-planner-calendar";
import {
  usePublishPlannerPostNow,
  useRetryPlannerPublish,
  useSchedulePlannerPostV2,
  useUnschedulePlannerPost,
} from "../../hooks/use-planner-publishing";
import { POST_STATUS_META } from "./planner-v2-utils";
import { CommentsAutomationPanel } from "./comments-automation-panel";
import { PublishedPostView } from "./published-post-view";
import type { usePlannerPost } from "../../hooks/use-planner-calendar";

/** Passo 4 do criador (spec 0057/0058): horário, horários sugeridos, publicar agora e acompanhamento. */

type ComposerPost = NonNullable<ReturnType<typeof usePlannerPost>["post"]>;
const SUGGESTION_WINDOW_DAYS = 7;
const MAX_SUGGESTIONS = 6;

function toDateTimeInputValue(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

const STAGGER_OPTIONS_MINUTES = [0, 5, 10, 15, 30];

export function ComposerScheduleStep({
  post,
  canSchedule,
  initialDate,
  groupAccountCount = 1,
}: {
  post: ComposerPost;
  canSchedule: boolean;
  initialDate?: Date;
  /** Contas do grupo que ainda não publicaram (spec 0074, RF-10): com mais de uma, dá para programar todas de uma vez. */
  groupAccountCount?: number;
}) {
  const isGroup = groupAccountCount > 1;
  const [scope, setScope] = useState<"group" | "post">("group");
  const [staggerMinutes, setStaggerMinutes] = useState(0);
  const actionScope = isGroup ? scope : "post";
  const chargedPublishCount = actionScope === "group" ? groupAccountCount : 1;
  const defaultDate = initialDate ?? (post.scheduledAt ? new Date(post.scheduledAt) : addDays(new Date(), 1));
  const [dateTimeValue, setDateTimeValue] = useState(toDateTimeInputValue(defaultDate));
  const suggestionRange = useMemo(() => ({ organizationIds: [post.organizationId], from: new Date(), to: addDays(new Date(), SUGGESTION_WINDOW_DAYS) }), [post.organizationId]);
  const { slots } = usePlannerSlots(suggestionRange);
  const schedulePost = useSchedulePlannerPostV2();
  const unschedulePost = useUnschedulePlannerPost();
  const publishNow = usePublishPlannerPostNow();
  const retryPublish = useRetryPlannerPublish();
  const showError = (error: Error) => toast.error(error.message || "Não deu certo. Tente de novo.");
  const reportGroupResult = (successMessage: string) => (result: { scheduledCount: number; skipped: Array<{ reason: string }> }) => {
    if (result.skipped.length === 0) {
      toast.success(result.scheduledCount > 1 ? `${successMessage} (${result.scheduledCount} contas)` : successMessage);
      return;
    }
    toast.warning(`${successMessage} em ${result.scheduledCount} conta(s). ${result.skipped.length} ficou(aram) de fora: ${result.skipped[0].reason}`);
  };
  const isFinished = post.status === "PUBLISHED" || post.status === "PUBLISHING";
  const suggestedSlots = slots.filter((slot) => slot.postTypes.length === 0 || slot.postTypes.includes(post.type)).slice(0, MAX_SUGGESTIONS);

  if (post.status === "PUBLISHED") return <PublishedPostView post={post} canReplyToComments={canSchedule} />;

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full bg-panel px-2.5 py-1 text-xs font-semibold", POST_STATUS_META[post.status].textClassName)}>{POST_STATUS_META[post.status].label}</span>
        {post.status === "SCHEDULED" && post.scheduledAt && (
          <span className="text-sm">para {format(new Date(post.scheduledAt), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}</span>
        )}
      </div>

      {post.status === "FAILED" && post.publishError && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span className="flex-1">{post.publishError}</span>
          {canSchedule && (
            <button
              type="button"
              data-guide={GUIDE_ANCHORS.plannerFailedRetry.id}
              onClick={() => retryPublish.mutate({ postId: post.id }, { onSuccess: () => toast.success("Tentando publicar de novo."), onError: showError })}
              className="inline-flex items-center gap-1 rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-white"
            >
              <RotateCcw className="size-3" /> Tentar de novo
            </button>
          )}
        </div>
      )}

      {!isFinished && (
        <>
          {suggestedSlots.length > 0 && (
            <section>
              <p className="mb-2 text-xs text-muted-foreground">Horários sugeridos</p>
              <div className="flex flex-wrap gap-2">
                {suggestedSlots.map((slot) => {
                  const slotDate = new Date(slot.startsAt);
                  return (
                    <button
                      key={slotDate.toISOString()}
                      type="button"
                      onClick={() => setDateTimeValue(toDateTimeInputValue(slotDate))}
                      className={cn(
                        "rounded-full border-[1.5px] border-dashed border-line px-3 py-1 text-xs capitalize",
                        dateTimeValue === toDateTimeInputValue(slotDate) && "border-solid border-foreground bg-foreground text-background",
                      )}
                    >
                      {format(slotDate, "EEE d, HH:mm", { locale: ptBR })}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
          <section>
            <p className="mb-2 text-xs text-muted-foreground">Data e hora</p>
            <Input type="datetime-local" value={dateTimeValue} onChange={(event) => setDateTimeValue(event.target.value)} className="max-w-64 rounded-2xl" />
          </section>
        </>
      )}

      {isGroup && canSchedule && !isFinished && (
        <section data-guide={GUIDE_ANCHORS.plannerComposerScheduleScope.id}>
          <p className="mb-2 text-xs text-muted-foreground">Contas</p>
          <div className="flex flex-wrap items-center gap-2">
            {(["group", "post"] as const).map((scopeOption) => (
              <button
                key={scopeOption}
                type="button"
                onClick={() => setScope(scopeOption)}
                className={cn("rounded-full px-3.5 py-1.5 text-sm", scope === scopeOption ? "bg-foreground font-semibold text-background" : "bg-panel")}
              >
                {scopeOption === "group" ? `Todas as ${groupAccountCount} contas` : "Só esta conta"}
              </button>
            ))}
            {scope === "group" && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Intervalo entre contas
                <select
                  value={staggerMinutes}
                  onChange={(event) => setStaggerMinutes(Number(event.target.value))}
                  className="rounded-full bg-panel px-3 py-1.5 text-sm text-foreground"
                >
                  {STAGGER_OPTIONS_MINUTES.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes === 0 ? "Sem intervalo" : `${minutes} min`}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {chargedPublishCount > 1 ? `${chargedPublishCount} publicações: cada conta publicada cobra Stars em separado.` : "1 publicação será cobrada ao sair."}
          </p>
        </section>
      )}

      {post.targetNetworks.includes("INSTAGRAM") && post.type !== "STORY" && <CommentsAutomationPanel postId={post.id} />}

      {canSchedule && !isFinished ? (
        <div className="flex flex-wrap justify-end gap-2">
          {post.status === "SCHEDULED" && (
            <button type="button" onClick={() => unschedulePost.mutate({ postId: post.id, scope: actionScope }, { onError: showError })} className="rounded-full bg-panel px-4 py-2 text-sm">
              Desprogramar
            </button>
          )}
          <button
            type="button"
            disabled={publishNow.isPending}
            onClick={() => publishNow.mutate({ postId: post.id, scope: actionScope }, { onSuccess: reportGroupResult("Publicando agora…"), onError: showError })}
            className="rounded-full bg-panel px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Publicar agora
          </button>
          <button
            type="button"
            data-guide={GUIDE_ANCHORS.plannerComposerSchedule.id}
            disabled={schedulePost.isPending || !dateTimeValue}
            onClick={() =>
              schedulePost.mutate(
                { postId: post.id, scheduledAt: new Date(dateTimeValue), scope: actionScope, staggerMinutes: actionScope === "group" ? staggerMinutes : 0 },
                { onSuccess: (result) => { reportGroupResult("Post programado.")(result); emitTourResult({ kind: GUIDE_RESULT_KINDS.plannerPostScheduled }); }, onError: showError },
              )
            }
            className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:opacity-40"
          >
            {post.status === "SCHEDULED" ? "Reprogramar" : "Programar"}
          </button>
        </div>
      ) : (
        !isFinished && <p className="text-sm text-muted-foreground">Seu papel não permite programar neste cliente. Peça a quem aprova.</p>
      )}
    </div>
  );
}
