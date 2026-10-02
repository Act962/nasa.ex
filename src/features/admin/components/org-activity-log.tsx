"use client";

import { useState, useEffect, useCallback } from "react";
import { APP_LABELS } from "@/features/admin/lib/activity-constants";
import { Clock, ChevronDown, Filter } from "lucide-react";

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
  appSlug: string;
  actionLabel: string;
  createdAt: string;
}

interface OrgMember {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string };
}

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  owner:     { label: "Master",    color: "text-info", bg: "bg-info/10" },
  admin:     { label: "Adm",       color: "text-foreground", bg: "bg-knob" },
  member:    { label: "Single",    color: "text-muted-foreground", bg: "bg-muted" },
  moderador: { label: "Moderador", color: "text-warning", bg: "bg-warning/10" },
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function formatDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function OrgActivityLog({ orgId, members }: { orgId: string; members: OrgMember[] }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);
  const [filterUser, setFilterUser] = useState("all");
  const [filterApp, setFilterApp] = useState("all");

  const fetchLogs = useCallback(async (newLimit = limit, userId = filterUser, appSlug = filterApp) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(newLimit), offset: "0" });
      if (userId !== "all") params.set("userId", userId);
      if (appSlug !== "all") params.set("appSlug", appSlug);
      const res = await fetch(`/api/admin/orgs/${orgId}/activity?${params}`);
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [orgId, limit, filterUser, filterApp]);

  useEffect(() => {
    fetchLogs(limit, filterUser, filterApp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, limit, filterUser, filterApp]);

  const handleLoadMore = () => {
    const next = limit + 50;
    setLimit(next);
  };

  // Unique apps present in logs
  const appsInLogs = Array.from(new Set(logs.map((l) => l.appSlug)));

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          Todas as Atividades
          {!loading && (
            <span className="text-xs font-normal text-muted-foreground">({total} registros)</span>
          )}
        </h2>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

          {/* Member filter */}
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="bg-muted border border-line text-foreground text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-ring"
          >
            <option value="all">Todos os membros</option>
            {members.map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.name ?? m.user.email}
              </option>
            ))}
          </select>

          {/* App filter */}
          <select
            value={filterApp}
            onChange={(e) => setFilterApp(e.target.value)}
            className="bg-muted border border-line text-foreground text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-ring"
          >
            <option value="all">Todos os apps</option>
            {appsInLogs.map((slug) => (
              <option key={slug} value={slug}>
                {APP_LABELS[slug] ?? slug}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Log list */}
      <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
              <div className="w-7 h-7 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-48 bg-muted rounded" />
                <div className="h-2.5 w-32 bg-muted rounded" />
              </div>
              <div className="h-2.5 w-28 bg-muted rounded shrink-0" />
            </div>
          ))
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma atividade encontrada.
          </div>
        ) : (
          <>
            {logs.map((log) => {
              const memberInfo = members.find((m) => m.user.id === log.userId);
              const role = memberInfo?.role ?? "member";
              const roleMeta = ROLE_META[role] ?? ROLE_META.member;
              const appLabel = APP_LABELS[log.appSlug] ?? log.appSlug;
              const avatar = log.userImage;
              const initWord = initials(log.userName);

              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors min-w-0"
                >
                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-full bg-knob shrink-0 flex items-center justify-center overflow-hidden">
                    {avatar
                      ? /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={avatar} alt={log.userName} className="w-full h-full object-cover" />
                      : <span className="text-[10px] font-bold text-foreground">{initWord}</span>
                    }
                  </div>

                  {/* Name */}
                  <span className="text-xs font-semibold text-foreground shrink-0 max-w-[100px] truncate">
                    {log.userName}
                  </span>

                  {/* Role badge */}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${roleMeta.color} ${roleMeta.bg}`}>
                    {roleMeta.label}
                  </span>

                  <span className="text-muted-foreground/70 shrink-0">·</span>

                  {/* App */}
                  <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0 whitespace-nowrap">
                    {appLabel}
                  </span>

                  <span className="text-muted-foreground/70 shrink-0">·</span>

                  {/* Action */}
                  <span className="text-xs text-foreground flex-1 truncate">
                    {log.actionLabel}
                  </span>

                  {/* Date */}
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0 ml-auto pl-2">
                    {formatDate(log.createdAt)}
                  </span>
                </div>
              );
            })}

            {logs.length >= limit && total > limit && (
              <div className="py-3 text-center">
                <button
                  onClick={handleLoadMore}
                  className="flex items-center gap-1.5 mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  Carregar mais ({total - limit} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
