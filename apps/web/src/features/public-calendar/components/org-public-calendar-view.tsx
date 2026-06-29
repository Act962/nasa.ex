"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/pt-br";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Grid as GridIcon,
  List as ListIcon,
  LockKeyhole,
} from "lucide-react";
import { imgSrc } from "@/features/public-calendar/utils/img-src";
import {
  buildVariableHolidays,
  getHoliday,
  getMobilizationEvent,
} from "@/features/public-calendar/utils/holidays";
import { useCountdown } from "../hooks/use-countdown";

dayjs.locale("pt-br");

// Mesma constante do workspace calendar — mantém visual consistente.
const CARD_HEIGHT = 52;
const CARD_GAP = 4;
const CELL_PADDING = 5;
const MAX_VISIBLE = 4;
const PLUS_MORE_HEIGHT = 25;
const EMPTY_ROW_HEIGHT = 56;

function isEmoji(value?: string | null): value is string {
  return !!value && !value.startsWith("http") && !value.startsWith("/") && value.length <= 4;
}

// Aceita ambos os shapes do procedure: minimal (poucos campos) e full
// (mesmo do workspace calendar). Campos extras são opcionais.
interface ActionItem {
  id: string;
  title: string;
  startDate: Date | string | null;
  dueDate: Date | string | null;
  endDate: Date | string | null;
  isDone?: boolean;
  coverImage?: string | null;
  workspaceId?: string | null;
  workspace?: {
    id: string;
    name: string;
    color?: string | null;
    icon?: string | null;
    coverImage?: string | null;
  } | null;
  // Full-only (mode === "full"):
  orgProject?: {
    id: string;
    name: string;
    type?: string | null;
    color?: string | null;
  } | null;
  lead?: { id: string; name: string } | null;
  user?: { id: string; name: string; image: string | null } | null;
}

/**
 * View pública pro link `/calendario/equipe/<slug>/<token>`. Mostra o
 * calendário consolidado da org com 2 níveis de detalhe (full vs minimal)
 * decididos server-side. Responsivo: lista no mobile, grid no desktop.
 */
export function OrgPublicCalendarView({
  slug,
  token,
}: {
  slug: string;
  token: string;
}) {
  const [cursor, setCursor] = useState<Dayjs>(dayjs());
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<ActionItem | null>(null);

  const startDate = cursor.startOf("month").subtract(7, "day").toISOString();
  const endDate = cursor.endOf("month").add(7, "day").toISOString();

  const { data, isLoading, isError, error } = useQuery({
    ...orpc.public.calendar.getByOrgShare.queryOptions({
      input: { slug, token, startDate, endDate },
    }),
    staleTime: 60_000,
    retry: false,
  });

  // Erro 404 = link expirado ou inválido. UI dedicada — não distinguimos
  // entre "nunca existiu" e "expirou" no front pra alinhar com o backend.
  if (isError) {
    return <ExpiredScreen errorMessage={(error as any)?.message} />;
  }

  const actions = (data?.actions ?? []) as ActionItem[];
  const mode = data?.mode ?? "minimal";
  const orgName = data?.org?.name ?? "";
  const orgLogo = data?.org?.logo ?? null;
  const expiresAt = data?.expiresAt ?? null;

  return (
    <div className="min-h-screen bg-background">
      <Header
        orgName={orgName}
        orgLogo={orgLogo}
        expiresAt={expiresAt}
        mode={mode}
        view={view}
        onViewChange={setView}
        cursor={cursor}
        onCursorChange={setCursor}
      />

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6">
        {isLoading ? (
          <CalendarSkeleton />
        ) : (
          <>
            {/* Desktop: respeita escolha; default grid. Mobile: sempre lista. */}
            <div className={cn(view === "grid" ? "hidden md:block" : "hidden")}>
              <MonthGrid
                actions={actions}
                cursor={cursor}
                mode={mode}
                onSelect={setSelected}
              />
            </div>
            <div className={cn(view === "list" ? "block" : "block md:hidden")}>
              <ListView actions={actions} mode={mode} onSelect={setSelected} />
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-border/60 px-4 py-6 text-center text-xs text-muted-foreground">
        Calendário compartilhado publicamente por{" "}
        <strong className="text-foreground">{orgName}</strong>.
        <br />
        Este link tem validade limitada e pode ser revogado a qualquer momento
        pelo administrador da empresa.
      </footer>

      {/* Detalhe do evento — Sheet read-only. Só aparece em mode=full,
          que é quando o visitante é membro logado da org. Visitantes
          anônimos não conseguem abrir (MiniCard ignora clicks). */}
      <Sheet
        open={!!selected && mode === "full"}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent
          side="right"
          className="w-full max-w-md overflow-auto p-0 sm:max-w-lg"
        >
          <SheetHeader className="p-4 pb-2">
            <SheetTitle>Detalhes do evento</SheetTitle>
          </SheetHeader>
          {selected && <ActionDetailPanel action={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────

function Header({
  orgName,
  orgLogo,
  expiresAt,
  mode,
  view,
  onViewChange,
  cursor,
  onCursorChange,
}: {
  orgName: string;
  orgLogo: string | null;
  expiresAt: Date | string | null;
  mode: "full" | "minimal";
  view: "grid" | "list";
  onViewChange: (v: "grid" | "list") => void;
  cursor: Dayjs;
  onCursorChange: (d: Dayjs) => void;
}) {
  const countdown = useCountdown(expiresAt);

  // Cor do badge muda com proximidade da expiração.
  const expiryColor =
    countdown.expired
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : countdown.msLeft < 10 * 60_000
        ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30"
        : countdown.msLeft < 30 * 60_000
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";

  return (
    <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-3 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          {orgLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={orgLogo}
              alt={orgName}
              className="size-10 rounded-lg border object-cover"
            />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700">
              <CalendarIcon className="size-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold sm:text-lg">{orgName}</h1>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              Calendário público da empresa
              {mode === "minimal" && (
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  <LockKeyhole className="size-3" />
                  visão limitada
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              expiryColor,
            )}
            title={
              expiresAt
                ? `Expira em ${new Date(expiresAt).toLocaleString("pt-BR")}`
                : ""
            }
          >
            <Clock className="size-3" />
            {countdown.label}
          </span>

          {/* Toggle Mês / Lista — visível só em desktop (mobile força lista) */}
          <div className="hidden items-center rounded-md border bg-card md:flex">
            <Button
              size="sm"
              variant={view === "grid" ? "secondary" : "ghost"}
              onClick={() => onViewChange("grid")}
              className="h-7 gap-1 rounded-r-none px-2 text-xs"
            >
              <GridIcon className="size-3" />
              Mês
            </Button>
            <Button
              size="sm"
              variant={view === "list" ? "secondary" : "ghost"}
              onClick={() => onViewChange("list")}
              className="h-7 gap-1 rounded-l-none px-2 text-xs"
            >
              <ListIcon className="size-3" />
              Lista
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="size-7 p-0"
              onClick={() => onCursorChange(cursor.subtract(1, "month"))}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="min-w-[100px] text-center text-xs font-medium capitalize">
              {cursor.format("MMMM YYYY")}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="size-7 p-0"
              onClick={() => onCursorChange(cursor.add(1, "month"))}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── Grid mensal (desktop) ─────────────────────────────────────────────────

function MonthGrid({
  actions,
  cursor,
  mode,
  onSelect,
}: {
  actions: ActionItem[];
  cursor: Dayjs;
  mode: "full" | "minimal";
  onSelect: (a: ActionItem) => void;
}) {
  // Agrupamento multi-dia mesmo no minimal: ação aparece em cada dia entre
  // start e dueDate/endDate, igual no calendar workspace privado.
  const actionsByDay = useMemo(() => {
    const map = new Map<string, ActionItem[]>();
    const MAX_DAYS = 90;
    for (const a of actions) {
      const startStr = a.startDate || a.dueDate;
      if (!startStr) continue;
      const start = dayjs(startStr).startOf("day");
      const candidates = [a.endDate, a.dueDate]
        .filter((d): d is Date | string => !!d)
        .map((d) => dayjs(d).startOf("day"));
      let end = start;
      for (const c of candidates) {
        if (c.isAfter(end)) end = c;
      }
      let curs = start;
      let i = 0;
      while (!curs.isAfter(end) && i < MAX_DAYS) {
        const key = curs.format("YYYY-MM-DD");
        const arr = map.get(key);
        if (arr) arr.push(a);
        else map.set(key, [a]);
        curs = curs.add(1, "day");
        i++;
      }
    }
    return map;
  }, [actions]);

  const days = useMemo(() => {
    const startOfMonth = cursor.startOf("month");
    const firstDayOfGrid = startOfMonth.subtract(startOfMonth.day(), "day");
    return Array.from({ length: 42 }, (_, i) => firstDayOfGrid.add(i, "day"));
  }, [cursor]);

  // Feriados móveis (Páscoa, Carnaval, etc) precisam ser calculados por ano.
  // O mês visível pode tocar 2 anos (jan/dez), então pegamos todos.
  const variableHolidays = useMemo(() => {
    const years = new Set(days.map((d) => d.year()));
    return buildVariableHolidays(years);
  }, [days]);

  // Altura de cada linha = altura do maior cell visível na semana.
  // Mesma fórmula do workspace calendar: cards stack 52px cada com 4px gap.
  // Soma ~22px por label de feriado/mobilização presente na linha pra que
  // células com label + cards não sobreponham.
  const HOLIDAY_LABEL_HEIGHT = 22;
  const rowHeights = useMemo(() => {
    const heights: number[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const row = days.slice(i, i + 7);
      let maxCards = 0;
      let maxTopLabels = 0;
      let rowHasOverflow = false;
      for (const day of row) {
        const key = day.format("YYYY-MM-DD");
        const count = actionsByDay.get(key)?.length ?? 0;
        maxCards = Math.max(maxCards, Math.min(count, MAX_VISIBLE));
        if (count > MAX_VISIBLE) rowHasOverflow = true;
        const labels =
          (getHoliday(day, variableHolidays) ? 1 : 0) +
          (getMobilizationEvent(day) ? 1 : 0);
        maxTopLabels = Math.max(maxTopLabels, labels);
      }
      const labelsHeight = maxTopLabels * HOLIDAY_LABEL_HEIGHT;
      if (maxCards === 0) {
        heights.push(EMPTY_ROW_HEIGHT + labelsHeight);
      } else {
        const base =
          2 * CELL_PADDING + maxCards * CARD_HEIGHT + (maxCards - 1) * CARD_GAP;
        heights.push(
          (rowHasOverflow ? base + CARD_GAP + PLUS_MORE_HEIGHT : base) +
            labelsHeight,
        );
      }
    }
    return heights;
  }, [days, actionsByDay, variableHolidays]);

  const weekDayLabels = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/30 text-[11px] font-semibold text-muted-foreground">
        {weekDayLabels.map((d) => (
          <div key={d} className="px-2 py-2 text-center">
            {d}
          </div>
        ))}
      </div>
      <div>
        {Array.from({ length: 6 }, (_, weekIdx) => {
          const weekDays = days.slice(weekIdx * 7, weekIdx * 7 + 7);
          const height = rowHeights[weekIdx] ?? EMPTY_ROW_HEIGHT;
          return (
            <div
              key={weekIdx}
              className="grid grid-cols-7 border-b last:border-b-0"
              style={{ minHeight: `${height + 24}px` }} // +24 pro espaço do número do dia
            >
              {weekDays.map((day) => {
                const key = day.format("YYYY-MM-DD");
                const isCurrentMonth = day.month() === cursor.month();
                const isToday = day.isSame(dayjs(), "day");
                const dayActions = actionsByDay.get(key) ?? [];
                const overflow = dayActions.length - MAX_VISIBLE;
                const holiday = getHoliday(day, variableHolidays);
                const mobilization = getMobilizationEvent(day);
                const topLabels = [holiday, mobilization].filter(
                  (h): h is NonNullable<typeof h> => !!h,
                );
                return (
                  <div
                    key={key}
                    className={cn(
                      "relative border-r last:border-r-0",
                      !isCurrentMonth && "bg-muted/20 text-muted-foreground/60",
                    )}
                    style={{ padding: `${CELL_PADDING}px` }}
                  >
                    <div
                      className={cn(
                        "mb-1 inline-flex size-5 items-center justify-center rounded-full text-[11px] font-semibold",
                        isToday && "bg-violet-600 text-white",
                      )}
                    >
                      {day.date()}
                    </div>

                    {/* Feriados / mobilizações — mesma origem dos dados que o
                        workspace calendar (FIXED_HOLIDAYS + variableHolidays +
                        MOBILIZATION_EVENTS). Aqui são read-only, sem Popover. */}
                    {topLabels.length > 0 && (
                      <div className="mb-1 flex flex-col gap-0.5">
                        {topLabels.map((ev, i) => (
                          <div
                            key={i}
                            className={cn(
                              "truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight",
                              ev.color === "amber"
                                ? "bg-amber-400/20 text-amber-700 dark:text-amber-300"
                                : "bg-violet-400/20 text-violet-700 dark:text-violet-300",
                            )}
                            title={ev.title}
                          >
                            {ev.label}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col" style={{ gap: `${CARD_GAP}px` }}>
                      {dayActions.slice(0, MAX_VISIBLE).map((a) => (
                        <MiniCard
                          key={`${a.id}-${key}`}
                          action={a}
                          clickable={mode === "full"}
                          onClick={() => onSelect(a)}
                        />
                      ))}
                      {overflow > 0 && (
                        <div
                          className="flex items-center justify-center rounded-md bg-muted/60 text-[10px] font-medium text-muted-foreground"
                          style={{ height: `${PLUS_MORE_HEIGHT}px` }}
                        >
                          + {overflow} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Card visual igual ao do `WorkspaceCalendarMonthGrid` (52px, cover fallback
 * chain + banner inferior com título/horário + badges de workspace/projeto
 * no topo). Sem dnd-kit — view é read-only.
 */
function MiniCard({
  action,
  clickable,
  onClick,
}: {
  action: ActionItem;
  clickable?: boolean;
  onClick?: () => void;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [wsCoverFailed, setWsCoverFailed] = useState(false);
  const [creatorImgFailed, setCreatorImgFailed] = useState(false);

  const color = action.workspace?.color ?? "#7c3aed";
  const dateStr = action.dueDate || action.startDate;
  const time = dateStr ? dayjs(dateStr).format("HH:mm") : "";

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
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : -1}
      onClick={clickable ? onClick : undefined}
      onKeyDown={(e) => {
        if (!clickable || !onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group relative w-full overflow-hidden rounded-md text-left",
        clickable &&
          "cursor-pointer transition-shadow hover:ring-2 hover:ring-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      )}
      style={{ height: `${CARD_HEIGHT}px`, backgroundColor: color }}
      title={
        clickable
          ? `${action.title} — clique pra ver detalhes`
          : action.title
      }
    >
      {/* Camada de fallback SEMPRE presente: gradient + inicial grande */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, ${color}cc 60%, ${color}80 100%)`,
        }}
      >
        <span className="select-none text-2xl font-bold text-white/30">
          {action.title.charAt(0).toUpperCase()}
        </span>
      </div>

      {actionCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={actionCover}
          alt={action.title}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setCoverFailed(true)}
        />
      ) : workspaceCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={workspaceCover}
          alt={action.workspace?.name ?? ""}
          className="absolute inset-0 h-full w-full object-cover opacity-90"
          onError={() => setWsCoverFailed(true)}
        />
      ) : creatorAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={creatorAvatar}
          alt={action.user?.name ?? ""}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setCreatorImgFailed(true)}
        />
      ) : wsEmoji ? (
        <div className="absolute inset-0 flex items-center justify-center text-2xl opacity-60">
          {wsEmoji}
        </div>
      ) : null}

      {/* Banner inferior com título + horário */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-1.5 pb-1 pt-6">
        <div className="truncate text-[9px] font-bold leading-tight text-white drop-shadow">
          {action.isDone ? "✓ " : ""}
          {action.title}
        </div>
        {time && (
          <div className="text-[8px] font-medium text-white/90">{time}</div>
        )}
      </div>

      {/* Workspace tag no topo esquerdo */}
      {action.workspace?.name && (
        <div
          className={cn(
            "absolute left-1.5 top-1.5 truncate rounded bg-black/10 px-1 py-0.5 text-[6.4px] font-semibold text-white backdrop-blur-sm",
            action.orgProject?.name || action.lead?.name
              ? "max-w-[42%]"
              : "max-w-[60%]",
          )}
          title={`Workspace: ${action.workspace.name}`}
        >
          {action.workspace.name}
        </div>
      )}

      {/* Cliente/Projeto ou Lead — topo direito (só aparece em mode=full) */}
      {action.orgProject?.name ? (
        <div
          className="absolute right-1.5 top-1.5 max-w-[42%] truncate rounded px-1 py-0.5 text-[6.4px] font-bold text-white backdrop-blur-sm"
          style={{
            backgroundColor: action.orgProject.color
              ? `${action.orgProject.color}1A`
              : "rgba(0,0,0,0.1)",
          }}
          title={`${action.orgProject.type === "client" ? "Cliente" : "Projeto"}: ${action.orgProject.name}`}
        >
          {action.orgProject.type === "client" ? "👤 " : "📁 "}
          {action.orgProject.name}
        </div>
      ) : action.lead?.name ? (
        <div
          className="absolute right-1.5 top-1.5 max-w-[42%] truncate rounded bg-amber-500/10 px-1 py-0.5 text-[6.4px] font-bold text-white backdrop-blur-sm"
          title={`Lead: ${action.lead.name}`}
        >
          👤 {action.lead.name}
        </div>
      ) : null}
    </div>
  );
}

// ─── List view (mobile + opcional desktop) ─────────────────────────────────

function ListView({
  actions,
  mode,
  onSelect,
}: {
  actions: ActionItem[];
  mode: "full" | "minimal";
  onSelect: (a: ActionItem) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, ActionItem[]>();
    for (const a of actions) {
      const start = a.startDate || a.dueDate;
      if (!start) continue;
      const key = dayjs(start).format("YYYY-MM-DD");
      const arr = map.get(key);
      if (arr) arr.push(a);
      else map.set(key, [a]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [actions]);

  if (grouped.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhuma ação agendada neste período.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([dateKey, dayActions]) => {
        const d = dayjs(dateKey);
        return (
          <div key={dateKey} className="rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
              <div className="flex size-9 flex-col items-center justify-center rounded-md bg-violet-500/15 text-center text-violet-700">
                <div className="text-[9px] font-semibold uppercase leading-none">
                  {d.format("MMM")}
                </div>
                <div className="text-sm font-bold leading-none">
                  {d.format("DD")}
                </div>
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold capitalize">
                  {d.format("dddd")}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {dayActions.length} ação
                  {dayActions.length === 1 ? "" : "ões"}
                </div>
              </div>
            </div>
            <div className="divide-y">
              {dayActions.map((a) => (
                <ActionListRow
                  key={a.id}
                  action={a}
                  clickable={mode === "full"}
                  onClick={() => onSelect(a)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionListRow({
  action,
  clickable,
  onClick,
}: {
  action: ActionItem;
  clickable?: boolean;
  onClick?: () => void;
}) {
  const start = action.startDate ? dayjs(action.startDate) : null;
  const due = action.dueDate ? dayjs(action.dueDate) : null;
  const sameDay = start && due ? start.isSame(due, "day") : true;
  const hasTimeRange = start && due && !start.isSame(due, "minute");

  const timeLabel = (() => {
    if (!start && !due) return null;
    if (hasTimeRange && start && due && sameDay) {
      return `${start.format("HH:mm")} – ${due.format("HH:mm")}`;
    }
    if (hasTimeRange && start && due) {
      return `${start.format("DD/MM HH:mm")} – ${due.format("DD/MM HH:mm")}`;
    }
    return (start ?? due)!.format("HH:mm");
  })();

  const color = action.workspace?.color ?? "#7c3aed";

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : -1}
      onClick={clickable ? onClick : undefined}
      onKeyDown={(e) => {
        if (!clickable || !onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "flex w-full items-start gap-3 px-3 py-2.5 text-left",
        clickable &&
          "cursor-pointer transition-colors hover:bg-muted/40 focus:outline-none focus-visible:bg-muted/40",
      )}
    >
      <span
        className="mt-1.5 size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-medium leading-tight">
            {action.isDone ? "✓ " : ""}
            {action.title}
          </div>
          {timeLabel && (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {timeLabel}
            </span>
          )}
        </div>
        {action.workspace?.name && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {action.workspace.name}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

function CalendarSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

// ─── Painel de detalhes do evento (mode = "full") ──────────────────────────

function ActionDetailPanel({ action }: { action: ActionItem }) {
  const start = action.startDate ? dayjs(action.startDate) : null;
  const due = action.dueDate ? dayjs(action.dueDate) : null;
  const isMultiDay = start && due && !start.isSame(due, "day");
  const sameDayTimeRange = start && due && start.isSame(due, "day") && !start.isSame(due, "minute");

  const cover = action.coverImage ? imgSrc(action.coverImage) : null;
  const workspaceCover = action.workspace?.coverImage ? imgSrc(action.workspace.coverImage) : null;
  const heroImg = cover ?? workspaceCover;
  const color = action.workspace?.color ?? "#7c3aed";

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div
        className="relative aspect-video w-full overflow-hidden border-y"
        style={{ backgroundColor: color }}
      >
        {heroImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImg}
            alt={action.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${color} 0%, ${color}cc 60%, ${color}80 100%)`,
            }}
          >
            <span className="text-6xl font-bold text-white/30">
              {action.title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4">
          <h2 className="text-xl font-bold text-white drop-shadow">
            {action.isDone ? "✓ " : ""}
            {action.title}
          </h2>
        </div>
      </div>

      <div className="space-y-3 px-4 pb-6">
        {/* Datas */}
        {(start || due) && (
          <div className="flex items-start gap-2 text-sm">
            <CalendarIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              {isMultiDay && start && due ? (
                <div>
                  <strong>{start.format("DD MMM YYYY")}</strong> a{" "}
                  <strong>{due.format("DD MMM YYYY")}</strong>
                </div>
              ) : (
                <div>
                  <strong>{(start ?? due)!.format("DD MMM YYYY")}</strong>
                </div>
              )}
              {sameDayTimeRange ? (
                <div className="text-xs text-muted-foreground">
                  {start!.format("HH:mm")} – {due!.format("HH:mm")}
                </div>
              ) : (start ?? due) ? (
                <div className="text-xs text-muted-foreground">
                  {(start ?? due)!.format("HH:mm")}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Workspace */}
        {action.workspace?.name && (
          <div className="flex items-center gap-2 text-sm">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-muted-foreground">Workspace:</span>
            <span className="font-medium">{action.workspace.name}</span>
          </div>
        )}

        {/* Cliente/Projeto */}
        {action.orgProject?.name && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {action.orgProject.type === "client" ? "Cliente:" : "Projeto:"}
            </span>
            <span
              className="font-medium"
              style={{ color: action.orgProject.color ?? undefined }}
            >
              {action.orgProject.name}
            </span>
          </div>
        )}

        {/* Lead */}
        {action.lead?.name && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Lead:</span>
            <span className="font-medium">{action.lead.name}</span>
          </div>
        )}

        {/* Criador */}
        {action.user?.name && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Criado por:</span>
            <span className="font-medium">{action.user.name}</span>
          </div>
        )}

        <p className="border-t pt-3 text-xs text-muted-foreground">
          Visualização rápida. Pra editar, abra a ação no kanban da sua empresa.
        </p>
      </div>
    </div>
  );
}

// ─── Tela de link expirado ─────────────────────────────────────────────────

function ExpiredScreen({ errorMessage }: { errorMessage?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="size-6" />
        </div>
        <h1 className="text-lg font-bold">Link expirado ou inválido</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {errorMessage && errorMessage.toLowerCase().includes("expirado")
            ? "O link de compartilhamento deste calendário já não está ativo."
            : "Este calendário não está disponível ou o link já não é válido."}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Peça ao administrador da empresa pra gerar um novo link.
        </p>
      </div>
    </div>
  );
}
