"use client";

import { useMemo } from "react";
import {
  FileTextIcon,
  CheckCircle2Icon,
  ClockIcon,
  PencilIcon,
  ListTodoIcon,
  LoaderIcon,
  SparklesIcon,
  BuildingIcon,
  UsersIcon,
  PlugIcon,
  CalendarCheckIcon,
  InstagramIcon,
  FacebookIcon,
  LinkedinIcon,
  TrendingUpIcon,
  AlertCircleIcon,
  CircleIcon,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/lib/auth-client";
import { useQueryPlatformIntegrations } from "@/features/integrations/hooks/use-integrations";
import { useNasaPlannerPosts, useNasaPlannerCards } from "../../hooks/use-nasa-planner";
import { CARD_STATUSES } from "../../constants";
import { cn } from "@/lib/utils";

interface PlatformBrand {
  key: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  bg: string;
  iconColor: string;
}

const KNOWN_PLATFORMS: PlatformBrand[] = [
  { key: "META",      label: "Meta (FB/IG)", Icon: FacebookIcon, bg: "bg-brand-facebook/10 border-brand-facebook/30", iconColor: "text-brand-facebook" },
  { key: "INSTAGRAM", label: "Instagram",    Icon: InstagramIcon, bg: "bg-brand-instagram/10 border-brand-instagram/30", iconColor: "text-brand-instagram" },
  { key: "LINKEDIN",  label: "LinkedIn",     Icon: LinkedinIcon, bg: "bg-info/15 border-info/30", iconColor: "text-info" },
  { key: "TIKTOK",    label: "TikTok",       Icon: SparklesIcon, bg: "bg-panel border-line", iconColor: "text-foreground" },
];

interface StatTone {
  ring: string;
  iconBg: string;
  iconColor: string;
}

const TONES: Record<string, StatTone> = {
  violet:  { ring: "from-info/15 to-transparent",        iconBg: "bg-info/15",             iconColor: "text-info" },
  emerald: { ring: "from-success/15 to-transparent",     iconBg: "bg-success/15",          iconColor: "text-success" },
  blue:    { ring: "from-info/15 to-transparent",        iconBg: "bg-info/15",             iconColor: "text-info" },
  amber:   { ring: "from-warning/15 to-transparent",     iconBg: "bg-warning/15",          iconColor: "text-warning" },
  rose:    { ring: "from-destructive/15 to-transparent", iconBg: "bg-destructive/15",      iconColor: "text-destructive" },
  zinc:    { ring: "from-muted-foreground/15 to-transparent", iconBg: "bg-muted-foreground/15", iconColor: "text-muted-foreground" },
};

function StatCard({
  label,
  value,
  sub,
  tone = "violet",
  Icon,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: keyof typeof TONES;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const t = TONES[tone];
  return (
    <Card className="relative overflow-hidden border bg-card/60 backdrop-blur transition hover:shadow-md hover:-translate-y-0.5">
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80", t.ring)} />
      <CardContent className="relative pt-5 pb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">{label}</p>
          {sub && <p className="text-[11px] text-muted-foreground/80 mt-1">{sub}</p>}
        </div>
        <div className={cn("size-9 rounded-xl flex items-center justify-center shrink-0", t.iconBg)}>
          <Icon className={cn("size-4", t.iconColor)} />
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {count} <span className="text-muted-foreground/60">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function getInitial(name: string | null | undefined) {
  return name?.trim()?.[0]?.toUpperCase() ?? "?";
}

export function DashboardTab({ plannerId }: { plannerId: string }) {
  const { posts } = useNasaPlannerPosts(plannerId);
  const { cards } = useNasaPlannerCards({ plannerId });
  const { data: organizations } = authClient.useListOrganizations();
  const { data: integrationsData } = useQueryPlatformIntegrations();

  const stats = useMemo(() => {
    const total = posts.length;
    const published = posts.filter((p) => p.status === "PUBLISHED").length;
    const scheduled = posts.filter((p) => p.status === "SCHEDULED").length;
    const draft = posts.filter((p) => p.status === "DRAFT").length;
    const pending = posts.filter((p) => p.status === "PENDING_APPROVAL").length;
    const approved = posts.filter((p) => p.status === "APPROVED").length;
    const failed = posts.filter((p) => p.status === "FAILED").length;
    return { total, published, scheduled, draft, pending, approved, failed };
  }, [posts]);

  const cardStats = useMemo(() => {
    const total = cards.length;
    const todo = cards.filter((c) => c.status === "PENDING").length;
    const inProgress = cards.filter((c) => c.status === "IN_PROGRESS").length;
    const done = cards.filter((c) => c.status === "COMPLETED").length;
    return { total, todo, inProgress, done };
  }, [cards]);

  // Empresas (clientOrgName) com contagem
  const companies = useMemo(() => {
    const map = new Map<string, { name: string; count: number; logo?: string }>();
    for (const p of posts) {
      const name = p.clientOrgName?.trim();
      if (!name) continue;
      const existing = map.get(name);
      const logo = (organizations ?? []).find((o) => o.name === name)?.logo ?? undefined;
      if (existing) existing.count += 1;
      else map.set(name, { name, count: 1, logo });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [posts, organizations]);

  // Participantes (createdBy)
  const participants = useMemo(() => {
    const map = new Map<string, { id: string; name: string; image?: string; count: number }>();
    for (const p of posts) {
      const u = p.createdBy;
      if (!u?.id) continue;
      const existing = map.get(u.id);
      if (existing) existing.count += 1;
      else map.set(u.id, { id: u.id, name: u.name ?? "—", image: u.image ?? undefined, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [posts]);

  // Integrações
  const integrations = integrationsData?.integrations ?? [];
  const platformsState = useMemo(() => {
    return KNOWN_PLATFORMS.map((p) => {
      const match = integrations.find((i) => i.platform === p.key);
      return { ...p, isActive: !!match?.isActive };
    });
  }, [integrations]);
  const activeCount = platformsState.filter((p) => p.isActive).length;

  // Atividades recentes (mistura posts + cards)
  const recentActivities = useMemo(() => {
    const events: Array<{ id: string; type: "post" | "card"; title: string; date: Date; status: string; sub?: string }> = [];
    for (const p of posts) {
      events.push({
        id: `post-${p.id}`,
        type: "post",
        title: p.title ?? "Post sem título",
        date: new Date(p.updatedAt ?? p.createdAt),
        status: p.status,
        sub: p.clientOrgName ?? undefined,
      });
    }
    for (const c of cards) {
      events.push({
        id: `card-${c.id}`,
        type: "card",
        title: c.title ?? "Card sem título",
        date: new Date(c.updatedAt ?? c.createdAt),
        status: c.status,
      });
    }
    return events.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6);
  }, [posts, cards]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total de Posts"    value={stats.total}     tone="violet"  Icon={FileTextIcon}      sub={`${posts.length === 0 ? "Nenhum ainda" : "criados no planner"}`} />
        <StatCard label="Publicados"        value={stats.published} tone="emerald" Icon={CheckCircle2Icon} sub={stats.published > 0 ? "ao vivo nas redes" : "—"} />
        <StatCard label="Agendados"         value={stats.scheduled} tone="blue"    Icon={ClockIcon}        sub={stats.scheduled > 0 ? "aguardando data" : "—"} />
        <StatCard label="Cards Pendentes"   value={cardStats.todo + cardStats.inProgress} tone="amber" Icon={ListTodoIcon} sub={`${cardStats.done} concluídos`} />
      </div>

      {/* Distribuição por status + Integrações */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUpIcon className="size-4 text-info" />
                Distribuição dos Posts
              </h3>
              <Badge variant="secondary" className="text-xs">{stats.total} total</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <StatusBar label="Rascunho"           count={stats.draft}     total={stats.total} color="bg-muted-foreground" />
              <StatusBar label="Aguardando aprov."  count={stats.pending}   total={stats.total} color="bg-warning" />
              <StatusBar label="Aprovados"          count={stats.approved}  total={stats.total} color="bg-info/50" />
              <StatusBar label="Agendados"          count={stats.scheduled} total={stats.total} color="bg-info" />
              <StatusBar label="Publicados"         count={stats.published} total={stats.total} color="bg-success" />
              {stats.failed > 0 && (
                <StatusBar label="Falhou"            count={stats.failed}    total={stats.total} color="bg-destructive" />
              )}
            </div>
            {stats.total > 0 && (
              <div className="pt-3 border-t flex items-center gap-3 text-xs text-muted-foreground">
                <CircleIcon className="size-3 fill-success stroke-success" />
                Taxa de conclusão:
                <span className="font-semibold text-foreground tabular-nums">
                  {Math.round((stats.published / stats.total) * 100)}%
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <PlugIcon className="size-4 text-info" />
                Integrações
              </h3>
              <Badge variant={activeCount > 0 ? "default" : "secondary"} className="text-xs">
                {activeCount}/{platformsState.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {platformsState.map((p) => (
                <div
                  key={p.key}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg border",
                    p.isActive ? p.bg : "bg-muted/40 border-border opacity-60",
                  )}
                >
                  <p.Icon className={cn("size-4 shrink-0", p.isActive ? p.iconColor : "text-muted-foreground")} />
                  <span className="text-xs font-medium flex-1 truncate">{p.label}</span>
                  {p.isActive ? (
                    <span className="size-1.5 rounded-full bg-success shrink-0" title="Conectado" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground shrink-0">off</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empresas + Participantes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <BuildingIcon className="size-4 text-info" />
                Empresas / Clientes
              </h3>
              <Badge variant="secondary" className="text-xs">{companies.length}</Badge>
            </div>
            {companies.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">
                Nenhuma empresa vinculada aos posts ainda.
              </div>
            ) : (
              <div className="space-y-1.5">
                {companies.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition"
                  >
                    <Avatar className="size-8 ring-1 ring-border">
                      <AvatarImage src={c.logo} alt={c.name} />
                      <AvatarFallback className="text-xs font-bold bg-info/15 text-info">
                        {getInitial(c.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium flex-1 truncate">{c.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 tabular-nums shrink-0">
                      {c.count} {c.count === 1 ? "post" : "posts"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <UsersIcon className="size-4 text-info" />
                Equipe Ativa
              </h3>
              <Badge variant="secondary" className="text-xs">{participants.length}</Badge>
            </div>
            {participants.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">
                Ninguém criou posts ainda.
              </div>
            ) : (
              <div className="space-y-1.5">
                {participants.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition"
                  >
                    <Avatar className="size-8 ring-1 ring-border">
                      <AvatarImage src={u.image} alt={u.name} />
                      <AvatarFallback className="text-xs font-bold">
                        {getInitial(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium flex-1 truncate">{u.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 tabular-nums shrink-0">
                      {u.count} {u.count === 1 ? "post" : "posts"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Atividades recentes */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CalendarCheckIcon className="size-4 text-info" />
              Atividades Recentes
            </h3>
            <Badge variant="secondary" className="text-xs">{recentActivities.length}</Badge>
          </div>
          {recentActivities.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">
              Nenhuma atividade registrada ainda.
            </div>
          ) : (
            <div className="divide-y">
              {recentActivities.map((ev) => {
                const isPost = ev.type === "post";
                const StatusIcon =
                  ev.status === "PUBLISHED" ? CheckCircle2Icon
                  : ev.status === "SCHEDULED" ? ClockIcon
                  : ev.status === "FAILED" ? AlertCircleIcon
                  : ev.status === "IN_PROGRESS" ? LoaderIcon
                  : ev.status === "DONE" ? CheckCircle2Icon
                  : isPost ? PencilIcon : ListTodoIcon;
                const tone =
                  ev.status === "PUBLISHED" || ev.status === "DONE" ? "text-success"
                  : ev.status === "SCHEDULED" ? "text-info"
                  : ev.status === "FAILED" ? "text-destructive"
                  : ev.status === "IN_PROGRESS" ? "text-warning"
                  : "text-muted-foreground";
                const cardStatusInfo = !isPost ? CARD_STATUSES[ev.status] : null;
                return (
                  <div key={ev.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className={cn("size-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0", tone)}>
                      <StatusIcon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{ev.title}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          {isPost ? "Post" : "Card"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        {cardStatusInfo?.label ?? ev.status}
                        {ev.sub && <> · {ev.sub}</>}
                        <span className="opacity-60">·</span>
                        <span>{formatDistanceToNow(ev.date, { addSuffix: true, locale: ptBR })}</span>
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">
                      {format(ev.date, "dd/MM HH:mm")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
