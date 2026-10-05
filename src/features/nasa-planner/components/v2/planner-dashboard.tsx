"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, CheckCircle2, ClipboardCheck, FileText, Instagram, Facebook, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import type { NasaPlannerPostStatus } from "@/generated/prisma/enums";
import { usePlannerDashboard, type BoardColumnKey } from "../../hooks/use-planner-board";
import { ClientAvatar } from "./client-avatar";
import { OriginBadge, creationOriginLabel } from "./creation-origin";
import { GoalsList, MomentsList } from "./planner-goals-moments";
import { POST_STATUS_META, POST_TYPE_META } from "./planner-v2-utils";
import type { ComposerRequest, PlannerClient } from "./planner-v2-types";

/** Dashboard do Planner: números gerais dos clientes do filtro, metas, momentos e o que precisa de atenção. */

export type DashboardTarget = { kind: "kanban"; column?: BoardColumnKey } | { kind: "calendar" } | { kind: "client"; organizationId: string };

const DISTRIBUTION: Array<{ label: string; statuses: NasaPlannerPostStatus[]; barClassName: string; column: BoardColumnKey }> = [
  { label: "Rascunho", statuses: ["IDEA", "DRAFT"], barClassName: "bg-knob", column: "draft" },
  { label: "Ajustes pedidos", statuses: ["CHANGES_REQUESTED"], barClassName: "bg-warning/70", column: "changes" },
  { label: "Aguardando aprovação", statuses: ["PENDING_APPROVAL"], barClassName: "bg-warning", column: "approval" },
  { label: "Aprovados", statuses: ["APPROVED"], barClassName: "bg-success/60", column: "approved" },
  { label: "Programados", statuses: ["SCHEDULED", "PUBLISHING"], barClassName: "bg-info", column: "scheduled" },
  { label: "Publicados", statuses: ["PUBLISHED"], barClassName: "bg-success", column: "published" },
  { label: "Falhou", statuses: ["FAILED"], barClassName: "bg-destructive", column: "failed" },
];

const ACTIVITY_LABEL: Record<string, string> = {
  SUBMITTED: "enviou para aprovação",
  COMMENT: "comentou em",
  CHANGES_REQUESTED: "pediu ajuste em",
  APPROVED: "aprovou",
  REOPENED: "reabriu",
  CREATED_BY_AI: "criou",
};

function StatCard({ label, value, hint, icon: Icon, toneClassName, onSelect }: { label: string; value: number; hint: string; icon: LucideIcon; toneClassName: string; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={cn("relative overflow-hidden rounded-[20px] bg-card p-3 text-left transition hover:-translate-y-0.5 hover:ring-1 hover:ring-line sm:p-4", toneClassName)}>
      <div className="flex items-start justify-between">
        <span className="text-2xl font-bold tabular-nums sm:text-3xl">{value}</span>
        <span className="grid size-9 place-items-center rounded-full bg-panel">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-1 text-[13px] font-medium sm:text-sm">{label}</p>
      <p className="line-clamp-2 text-[11px] text-muted-foreground sm:text-xs">{hint}</p>
    </button>
  );
}

function SectionCard({ title, count, children, className }: { title: string; count?: number; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[20px] bg-card p-3 sm:p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {count !== undefined && <span className="rounded-full bg-panel px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums">{count}</span>}
      </div>
      {children}
    </section>
  );
}

export function PlannerDashboard({
  organizationIds,
  clients,
  onOpenPost,
  onCreate,
  onNavigate,
}: {
  organizationIds?: string[];
  clients: PlannerClient[];
  onOpenPost: (postId: string) => void;
  onCreate: (request: ComposerRequest) => void;
  onNavigate: (target: DashboardTarget) => void;
}) {
  const { dashboard, isLoading } = usePlannerDashboard(organizationIds);
  if (isLoading || !dashboard) return <OrbitaSpinner className="mx-auto my-16 size-6" />;

  const countOf = (statuses: NasaPlannerPostStatus[]) => statuses.reduce((total, status) => total + (dashboard.statusCounts[status] ?? 0), 0);
  const totalPosts = Object.values(dashboard.statusCounts).reduce((total, count) => total + (count ?? 0), 0);
  const visibleClients = organizationIds?.length ? clients.filter((client) => organizationIds.includes(client.id)) : clients;
  const pendingApproval = countOf(["PENDING_APPROVAL"]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatCard label="Total de posts" value={totalPosts} hint={`${visibleClients.length} cliente${visibleClients.length === 1 ? "" : "s"}`} icon={FileText} toneClassName="bg-linear-to-br from-info/15 to-card" onSelect={() => onNavigate({ kind: "kanban" })} />
        <StatCard label="Publicados" value={countOf(["PUBLISHED"])} hint="ao vivo nas redes" icon={CheckCircle2} toneClassName="bg-linear-to-br from-success/15 to-card" onSelect={() => onNavigate({ kind: "kanban", column: "published" })} />
        <StatCard label="Programados" value={dashboard.scheduledNextWeek} hint="próximos 7 dias" icon={CalendarClock} toneClassName="bg-linear-to-br from-info/15 to-card" onSelect={() => onNavigate({ kind: "calendar" })} />
        <StatCard
          label="Esperando aprovação"
          value={pendingApproval}
          hint={dashboard.aiAwaitingReview > 0 ? `${dashboard.aiAwaitingReview} criação${dashboard.aiAwaitingReview > 1 ? "ões" : ""} de IA para revisar` : "nenhuma criação de IA"}
          icon={ClipboardCheck}
          toneClassName="bg-linear-to-br from-warning/15 to-card"
          onSelect={() => onNavigate({ kind: "kanban", column: "approval" })}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr]">
        <SectionCard title="Distribuição dos posts" count={totalPosts}>
          <div className="space-y-1.5">
            {DISTRIBUTION.map((row) => {
              const count = countOf(row.statuses);
              return (
                <button key={row.label} type="button" onClick={() => onNavigate({ kind: "kanban", column: row.column })} className="block w-full rounded-lg px-1 py-0.5 text-left hover:bg-panel">
                  <div className="flex justify-between text-xs">
                    <span>{row.label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {count} {totalPosts > 0 && `(${Math.round((count / totalPosts) * 100)}%)`}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel">
                    <div className={cn("h-full rounded-full", row.barClassName)} style={{ width: totalPosts ? `${(count / totalPosts) * 100}%` : "0%" }} />
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Precisa de você" count={dashboard.needsAttention.length}>
          {dashboard.needsAttention.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Tudo em dia.</p>
          ) : (
            <div className="space-y-1.5">
              {dashboard.needsAttention.map((post) => {
                const clientIndex = clients.findIndex((client) => client.id === post.organizationId);
                const client = clients[clientIndex];
                const originLabel = creationOriginLabel(post);
                return (
                  <button key={post.id} type="button" onClick={() => onOpenPost(post.id)} className={cn("flex w-full items-center gap-2 rounded-2xl bg-panel p-2 text-left", post.status === "CHANGES_REQUESTED" && "ring-1 ring-warning")}>
                    {client && <ClientAvatar name={client.name} logo={client.logo} clientIndex={Math.max(clientIndex, 0)} />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{post.title || POST_TYPE_META[post.type].label}</span>
                      <span className="flex items-center gap-1.5 text-[11px]">
                        {originLabel && <OriginBadge label={originLabel} />}
                        <span className={POST_STATUS_META[post.status].textClassName}>{post.status === "FAILED" ? "Falhou · tentar de novo" : POST_STATUS_META[post.status].label}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Momentos">
          <div className="max-h-80 overflow-y-auto">
            <MomentsList organizationIds={organizationIds} onCreate={onCreate} />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <SectionCard title="Metas da semana">
          <div className="max-h-96 overflow-y-auto">
            <GoalsList organizationIds={organizationIds} clients={clients} />
          </div>
        </SectionCard>

        <SectionCard title="Clientes e contas" count={visibleClients.length}>
          <div className="space-y-1.5">
            {visibleClients.map((client) => {
              const instagramAccounts = client.accounts.filter((account) => account.kind === "IG_BUSINESS");
              const facebookPages = client.accounts.filter((account) => account.kind === "FB_PAGE");
              const needsReconnect = client.accounts.some((account) => account.status === "NEEDS_RECONNECT");
              return (
                <button key={client.id} type="button" onClick={() => onNavigate({ kind: "client", organizationId: client.id })} className="flex w-full items-center gap-2 rounded-2xl bg-panel p-2 text-left hover:bg-knob/60">
                  <ClientAvatar name={client.name} logo={client.logo} clientIndex={clients.indexOf(client)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{client.name}</span>
                    <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className={cn("inline-flex items-center gap-0.5", instagramAccounts.length > 0 && "text-brand-instagram")}>
                        <Instagram className="size-3" /> {instagramAccounts[0]?.igUsername ? `@${instagramAccounts[0].igUsername}` : "sem Instagram"}
                      </span>
                      <span className={cn("inline-flex items-center gap-0.5", facebookPages.length > 0 && "text-brand-facebook")}>
                        <Facebook className="size-3" /> {facebookPages.length}
                      </span>
                      {needsReconnect && <span className="text-destructive">reconectar</span>}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{client.counts.scheduled} prog.</span>
                </button>
              );
            })}
            <Link href="/integrations" className="block pt-1 text-center text-xs text-muted-foreground hover:text-foreground">
              Conectar contas em Satélites →
            </Link>
          </div>
        </SectionCard>

        <SectionCard title="Atividades recentes" count={dashboard.activities.length}>
          {dashboard.activities.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nada por aqui ainda.</p>
          ) : (
            <div className="space-y-1.5">
              {dashboard.activities.map((activity) => (
                <button key={activity.id} type="button" onClick={() => onOpenPost(activity.postId)} className="flex w-full items-start gap-2 rounded-2xl bg-panel p-2 text-left text-xs">
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{activity.actorName}</span> {ACTIVITY_LABEL[activity.kind] ?? "mexeu em"} <span className="font-medium">“{activity.postTitle ?? "post"}”</span>
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(activity.at), { locale: ptBR, addSuffix: true })}</span>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
