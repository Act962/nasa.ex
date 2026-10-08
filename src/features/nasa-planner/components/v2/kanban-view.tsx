"use client";

import { useEffect, useRef } from "react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clapperboard, MessageCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import type { NasaPlannerPostType } from "@/generated/prisma/enums";
import { usePlannerBoard, type PlannerOriginFilter } from "../../hooks/use-planner-board";
import { collapsePublishGroups } from "../../lib/publish-group-collapse";
import { useSubmitPlannerPostForApproval } from "../../hooks/use-planner-approval";
import { useSchedulePlannerPostV2 } from "../../hooks/use-planner-publishing";
import { ClientAvatar } from "./client-avatar";
import { OriginBadge, creationOriginLabel } from "./creation-origin";
import { POST_TYPE_META, plannerMediaUrl } from "./planner-v2-utils";
import type { PlannerClient } from "./planner-v2-types";

/** Kanban do Calendário: posts em colunas por status. Arrastar só segue a regra (enviar para aprovação, programar). */

type BoardColumn = ReturnType<typeof usePlannerBoard>["columns"][number];
type BoardPost = BoardColumn["posts"][number] & { groupAccountCount?: number };
type ColumnKey = BoardColumn["key"];

const COLUMN_META: Record<ColumnKey, { label: string; hint: string; dotClassName: string }> = {
  draft: { label: "Rascunho", hint: "Ideias e rascunhos", dotClassName: "bg-knob" },
  changes: { label: "Ajuste pedido", hint: "Voltaram da revisão", dotClassName: "bg-warning" },
  approval: { label: "Aguardando aprovação", hint: "Solte um rascunho aqui para enviar", dotClassName: "bg-warning" },
  approved: { label: "Aprovado", hint: "Falta programar", dotClassName: "bg-success/60" },
  scheduled: { label: "Programado", hint: "Solte um aprovado aqui para programar", dotClassName: "bg-info" },
  published: { label: "Publicado", hint: "Últimos 30 dias", dotClassName: "bg-success" },
  failed: { label: "Falhou", hint: "Tente de novo", dotClassName: "bg-destructive" },
};
const DROP_RULES: Partial<Record<ColumnKey, ColumnKey[]>> = { approval: ["draft", "changes"], scheduled: ["approved"] };
const DRAG_ACTIVATION_DISTANCE_PX = 6;

function KanbanCard({ post, columnKey, client, clientIndex, showClient, onOpen, onRetry }: { post: BoardPost; columnKey: ColumnKey; client?: PlannerClient; clientIndex: number; showClient: boolean; onOpen: (postId: string) => void; onRetry: (postId: string) => void }) {
  const isDraggable = Object.values(DROP_RULES).some((sources) => sources?.includes(columnKey));
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `board:${post.id}`, data: { postId: post.id, columnKey, scheduledAt: post.scheduledAt }, disabled: !isDraggable });
  const typeMeta = POST_TYPE_META[post.type];
  const previewUrl = plannerMediaUrl(post.thumbnail ?? post.slides[0]?.imageKey ?? null);
  const originLabel = creationOriginLabel(post);
  const when = post.status === "PUBLISHED" ? post.publishedAt : post.scheduledAt;
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(post.id)}
      className={cn("rounded-2xl bg-card p-2 text-left", isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer", columnKey === "changes" && "ring-1 ring-warning ring-inset", isDragging && "opacity-40")}
    >
      {(previewUrl || post.videoKey) && (
        <div className={cn("mb-2 grid place-items-center overflow-hidden rounded-xl bg-knob/60", typeMeta.isVertical ? "h-28" : "h-20")}>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="size-full object-cover" />
          ) : (
            <Clapperboard className="size-5 text-muted-foreground" />
          )}
        </div>
      )}
      {originLabel && <OriginBadge label={originLabel} />}
      <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold">{post.title || typeMeta.label}</p>
      {(post.groupAccountCount ?? 1) > 1 && <p className="text-[11px] text-muted-foreground">{post.groupAccountCount} contas</p>}
      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
        {showClient && client && <ClientAvatar name={client.name} logo={client.logo} clientIndex={clientIndex} className="size-3.5 text-[6px] ring-1" />}
        <typeMeta.icon className="size-3" />
        <span className="truncate">
          {typeMeta.label} · {when ? format(new Date(when), "EEE dd/MM HH:mm", { locale: ptBR }) : "sem data"}
        </span>
        {post._count.reviews > 0 && (
          <span className="ml-auto inline-flex items-center gap-0.5">
            <MessageCircle className="size-3" /> {post._count.reviews}
          </span>
        )}
      </p>
      {columnKey === "failed" && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRetry(post.id);
          }}
          className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive"
        >
          <RotateCcw className="size-3" /> Tentar de novo
        </button>
      )}
    </div>
  );
}

function KanbanColumn({ column, children, guideAnchor, isFocused }: { column: BoardColumn; children: React.ReactNode; guideAnchor?: string; isFocused: boolean }) {
  const acceptsFrom = DROP_RULES[column.key];
  const { setNodeRef, isOver, active } = useDroppable({ id: `column:${column.key}`, data: { columnKey: column.key }, disabled: !acceptsFrom });
  const draggingFrom = (active?.data.current as { columnKey?: ColumnKey } | undefined)?.columnKey;
  const isValidTarget = Boolean(draggingFrom && acceptsFrom?.includes(draggingFrom));
  const meta = COLUMN_META[column.key];
  return (
    <div
      ref={setNodeRef}
      data-board-column={column.key}
      data-guide={guideAnchor}
      className={cn("flex w-[80vw] max-w-72 shrink-0 snap-start flex-col rounded-[18px] bg-panel/40 p-2 transition-colors sm:w-64", isFocused && "ring-2 ring-foreground/40 ring-inset", isValidTarget && "ring-1 ring-foreground/30 ring-inset", isValidTarget && isOver && "bg-panel")}
    >
      <div className="mb-2 flex items-center gap-1.5 px-1 pt-0.5">
        <span className={cn("size-2 rounded-full", meta.dotClassName)} />
        <span className="text-xs font-semibold">{meta.label}</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{column.total}</span>
      </div>
      <div className="flex max-h-[calc(100dvh-17rem)] flex-col gap-1.5 overflow-y-auto md:max-h-[calc(100dvh-15rem)]">
        {children}
        {column.total === 0 && <p className="px-1 py-4 text-center text-[11px] text-muted-foreground">{meta.hint}</p>}
        {column.total > column.posts.length && <p className="px-1 py-1 text-center text-[11px] text-muted-foreground">+{column.total - column.posts.length} mais antigos</p>}
      </div>
    </div>
  );
}

export function KanbanView({
  organizationIds,
  types,
  origin,
  focusColumn,
  clients,
  onOpenPost,
  onRetryPost,
}: {
  organizationIds?: string[];
  types?: NasaPlannerPostType[];
  origin: PlannerOriginFilter;
  focusColumn?: ColumnKey | null;
  clients: PlannerClient[];
  onOpenPost: (postId: string) => void;
  onRetryPost: (postId: string) => void;
}) {
  const { columns, isLoading } = usePlannerBoard({ organizationIds, types, origin });
  const submitForApproval = useSubmitPlannerPostForApproval();
  const schedulePost = useSchedulePlannerPostV2();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE_PX } }));
  const showClient = clients.length > 1;
  const boardRef = useRef<HTMLDivElement>(null);
  const hasColumns = columns.length > 0;

  // Vindo do Dashboard: rola até a coluna escolhida uma vez, quando ela aparece.
  useEffect(() => {
    if (!focusColumn || !hasColumns) return;
    boardRef.current?.querySelector(`[data-board-column="${focusColumn}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [focusColumn, hasColumns]);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const dragged = active.data.current as { postId: string; columnKey: ColumnKey; scheduledAt: Date | string | null } | undefined;
    const target = (over?.data.current as { columnKey?: ColumnKey } | undefined)?.columnKey;
    if (!dragged || !target || !DROP_RULES[target]?.includes(dragged.columnKey)) return;
    const showError = (error: Error) => toast.error(error.message);
    if (target === "approval") {
      submitForApproval.mutate({ postId: dragged.postId }, { onSuccess: () => toast.success("Enviado para aprovação."), onError: showError });
      return;
    }
    const intendedAt = dragged.scheduledAt ? new Date(dragged.scheduledAt) : null;
    if (!intendedAt || intendedAt.getTime() <= Date.now()) {
      toast.info("Escolha o horário para programar.");
      onOpenPost(dragged.postId);
      return;
    }
    schedulePost.mutate(
      { postId: dragged.postId, scheduledAt: intendedAt },
      { onSuccess: () => toast.success(`Programado para ${format(intendedAt, "EEE dd/MM 'às' HH:mm", { locale: ptBR })}.`), onError: showError },
    );
  };

  if (isLoading) return <OrbitaSpinner className="mx-auto my-16 size-6" />;
  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div ref={boardRef} className="scroll-hidden-x flex snap-x snap-mandatory scroll-px-3 gap-2 overflow-x-auto px-3 pb-3 md:snap-none">
        {columns.map((column) => (
          <KanbanColumn
            key={column.key}
            column={column}
            isFocused={focusColumn === column.key}
            guideAnchor={column.key === "draft" ? GUIDE_ANCHORS.plannerDraftsTab.id : column.key === "approval" ? GUIDE_ANCHORS.plannerApprovalTab.id : undefined}
          >
            {collapsePublishGroups(column.posts).map((post) => {
              const clientIndex = clients.findIndex((client) => client.id === post.organizationId);
              return <KanbanCard key={post.id} post={post} columnKey={column.key} client={clients[clientIndex]} clientIndex={Math.max(clientIndex, 0)} showClient={showClient} onOpen={onOpenPost} onRetry={onRetryPost} />;
            })}
          </KanbanColumn>
        ))}
      </div>
    </DndContext>
  );
}
