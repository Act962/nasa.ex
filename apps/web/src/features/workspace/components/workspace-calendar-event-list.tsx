"use client";

import { useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { Calendar, Clock, Briefcase, FolderOpen, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { imgSrc } from "@/features/public-calendar/utils/img-src";
import type { WorkspaceCalendarAction } from "./workspace-calendar-month-grid";

dayjs.locale("pt-br");

function isEmoji(value?: string | null): value is string {
  return !!value && !value.startsWith("http") && !value.startsWith("/") && value.length <= 4;
}

function ActionListCard({
  action,
  color,
  selected,
  onSelect,
}: {
  action: WorkspaceCalendarAction;
  color: string;
  selected: boolean;
  onSelect: (a: WorkspaceCalendarAction) => void;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [wsCoverFailed, setWsCoverFailed] = useState(false);
  const [creatorImgFailed, setCreatorImgFailed] = useState(false);

  const start = action.startDate ? dayjs(action.startDate) : null;
  const due = action.dueDate ? dayjs(action.dueDate) : null;
  const date = start || due;

  // Range de data (dia diferente) e/ou hora (mesmo dia, horas diferentes):
  // - 11 a 13 Mai 2026 (multi-dia)
  // - 13 Mai 2026 (mesmo dia)
  // - 08:00 às 18:00 (range no mesmo dia)
  // - 08:00 (sem entrega ou horas iguais)
  const isMultiDay = start && due && !start.isSame(due, "day");
  const hasTimeRange = start && due && !start.isSame(due, "minute");

  const dateLabel = (() => {
    if (!date) return null;
    if (isMultiDay && start && due) {
      const sameMonth = start.month() === due.month() && start.year() === due.year();
      const sameYear = start.year() === due.year();
      if (sameMonth) {
        return `${start.format("DD")} a ${due.format("DD MMM YYYY")}`;
      }
      if (sameYear) {
        return `${start.format("DD MMM")} a ${due.format("DD MMM YYYY")}`;
      }
      return `${start.format("DD MMM YYYY")} a ${due.format("DD MMM YYYY")}`;
    }
    return date.format("DD MMM YYYY");
  })();

  const timeLabel = (() => {
    if (!date) return null;
    if (hasTimeRange && start && due) {
      return `${start.format("HH:mm")} às ${due.format("HH:mm")}`;
    }
    return date.format("HH:mm");
  })();

  const actionCover =
    action.coverImage && !coverFailed ? imgSrc(action.coverImage) : null;
  const workspaceCover =
    !actionCover && action.workspace?.coverImage && !wsCoverFailed
      ? imgSrc(action.workspace.coverImage)
      : null;
  const creatorAvatar =
    !actionCover && !workspaceCover && action.user?.image && !creatorImgFailed
      ? imgSrc(action.user.image)
      : null;
  const wsEmoji =
    !actionCover && !workspaceCover && !creatorAvatar
      ? isEmoji(action.workspace?.icon)
        ? action.workspace?.icon
        : null
      : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(action)}
      className={cn(
        "group flex w-full gap-3 rounded-xl border p-3 text-left transition",
        selected
          ? "border-primary/50 bg-primary/10"
          : "border-border/50 bg-card hover:border-primary/30 hover:bg-muted/40",
      )}
    >
      {/* Thumb com fallback chain */}
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
        {actionCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={actionCover}
            alt={action.title}
            className="h-full w-full object-cover"
            onError={() => setCoverFailed(true)}
          />
        ) : workspaceCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={workspaceCover}
            alt={action.workspace?.name ?? ""}
            className="h-full w-full object-cover"
            onError={() => setWsCoverFailed(true)}
          />
        ) : creatorAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creatorAvatar}
            alt={action.user?.name ?? ""}
            className="h-full w-full object-cover"
            onError={() => setCreatorImgFailed(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-2xl"
            style={{ backgroundColor: color }}
          >
            {action.isDone ? (
              <span className="text-white drop-shadow">✓</span>
            ) : wsEmoji ? (
              <span>{wsEmoji}</span>
            ) : (
              <Briefcase className="h-5 w-5 text-white drop-shadow" />
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        {dateLabel && (
          <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium text-primary">
            <Calendar className="h-2.5 w-2.5" />
            <span className="capitalize">{dateLabel}</span>
          </div>
        )}
        <div className="truncate text-sm font-semibold leading-tight">
          {action.title}
        </div>
        {timeLabel && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5 shrink-0" />
            <span>{timeLabel}</span>
          </div>
        )}
        {action.workspace?.name && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="truncate">{action.workspace.name}</span>
          </div>
        )}
        {action.orgProject?.name && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px]">
            {action.orgProject.type === "client" ? (
              <UserIcon className="h-2.5 w-2.5 shrink-0" style={{ color: action.orgProject.color ?? undefined }} />
            ) : (
              <FolderOpen className="h-2.5 w-2.5 shrink-0" style={{ color: action.orgProject.color ?? undefined }} />
            )}
            <span
              className="truncate font-medium"
              style={{ color: action.orgProject.color ?? undefined }}
            >
              {action.orgProject.name}
            </span>
          </div>
        )}
        {action.lead?.name && !action.orgProject && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
            <UserIcon className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate font-medium">{action.lead.name}</span>
          </div>
        )}
      </div>
    </button>
  );
}

interface Props {
  actions: WorkspaceCalendarAction[];
  workspaceColorMap: Record<string, string>;
  selectedId?: string | null;
  onSelect: (action: WorkspaceCalendarAction) => void;
}

export function WorkspaceCalendarEventList({
  actions,
  workspaceColorMap,
  selectedId,
  onSelect,
}: Props) {
  const sorted = [...actions].sort((a, b) => {
    const da = a.dueDate || a.startDate;
    const db = b.dueDate || b.startDate;
    if (!da) return 1;
    if (!db) return -1;
    return new Date(da).getTime() - new Date(db).getTime();
  });

  const getColor = (a: WorkspaceCalendarAction) =>
    a.workspaceId ? workspaceColorMap[a.workspaceId] ?? "#7c3aed" : "#7c3aed";

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 px-4 py-3">
        <h3 className="font-semibold">Lista de Ações</h3>
        <p className="text-xs text-muted-foreground">
          {actions.length} ação{actions.length === 1 ? "" : "ões"} no mês
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Nenhuma ação encontrada.
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-auto p-3">
          {sorted.map((a) => (
            <ActionListCard
              key={a.id}
              action={a}
              color={getColor(a)}
              selected={selectedId === a.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
