import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { FileBarChart2, Calendar, User as UserIcon } from "lucide-react";

interface Snapshot {
  tracking?: {
    totalLeads?: number;
    wonLeads?: number;
    activeLeads?: number;
    conversionRate?: number;
  };
  chat?: {
    totalConversations?: number;
    totalMessages?: number;
    attendedConversations?: number;
    attendanceRate?: number;
  };
  forge?: {
    totalProposals?: number;
    pagas?: number;
    revenueTotal?: number;
  };
  spacetime?: {
    total?: number;
    confirmed?: number;
    done?: number;
  };
  nasaPlanner?: {
    total?: number;
    published?: number;
    starsSpent?: number;
  };
  metaAds?: {
    spend?: number;
    leads?: number;
    cpl?: number;
    roas?: number;
  };
  period?: { startDate?: string; endDate?: string };
}

interface PublicReportPageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicReportPage({ params }: PublicReportPageProps) {
  const { token } = await params;

  const report = await prisma.savedInsightReport.findUnique({
    where: { shareToken: token },
    include: {
      createdBy: { select: { name: true, image: true } },
      organization: { select: { name: true, logo: true } },
    },
  });

  if (!report) {
    notFound();
  }

  const snapshot = (report.snapshot ?? {}) as Snapshot;
  const period = snapshot.period;
  const periodLabel =
    period?.startDate && period?.endDate
      ? `${new Date(period.startDate).toLocaleDateString("pt-BR")} a ${new Date(period.endDate).toLocaleDateString("pt-BR")}`
      : "Período não informado";

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white dark:from-violet-950/20 dark:to-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-12 rounded-xl bg-violet-600 flex items-center justify-center">
              <FileBarChart2 className="size-6 text-white" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Relatório NASA Insights
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                {report.name}
              </h1>
            </div>
          </div>
          {report.description && (
            <p className="text-sm text-muted-foreground max-w-2xl">
              {report.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              {periodLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <UserIcon className="size-3.5" />
              {report.createdBy?.name ?? "Anônimo"} ·{" "}
              {report.organization?.name ?? ""}
            </span>
            <span>
              Salvo em {new Date(report.createdAt).toLocaleDateString("pt-BR")}
            </span>
          </div>
        </header>

        <div className="space-y-4">
          {snapshot.tracking && (
            <SnapshotCard title="Tracking / CRM" color="emerald">
              <Stat label="Leads totais" value={snapshot.tracking.totalLeads} />
              <Stat label="Convertidos" value={snapshot.tracking.wonLeads} />
              <Stat label="Ativos" value={snapshot.tracking.activeLeads} />
              <Stat
                label="Conversão"
                value={
                  snapshot.tracking.conversionRate !== undefined
                    ? `${snapshot.tracking.conversionRate.toFixed(1)}%`
                    : undefined
                }
              />
            </SnapshotCard>
          )}

          {snapshot.chat && (
            <SnapshotCard title="Chat" color="sky">
              <Stat label="Conversas" value={snapshot.chat.totalConversations} />
              <Stat label="Mensagens" value={snapshot.chat.totalMessages} />
              <Stat label="Atendidas" value={snapshot.chat.attendedConversations} />
              <Stat
                label="Taxa atend."
                value={
                  snapshot.chat.attendanceRate !== undefined
                    ? `${snapshot.chat.attendanceRate.toFixed(1)}%`
                    : undefined
                }
              />
            </SnapshotCard>
          )}

          {snapshot.forge && (
            <SnapshotCard title="Forge" color="amber">
              <Stat label="Propostas" value={snapshot.forge.totalProposals} />
              <Stat label="Pagas" value={snapshot.forge.pagas} />
              <Stat
                label="Receita"
                value={
                  snapshot.forge.revenueTotal !== undefined
                    ? `R$ ${snapshot.forge.revenueTotal.toFixed(2)}`
                    : undefined
                }
              />
            </SnapshotCard>
          )}

          {snapshot.spacetime && (
            <SnapshotCard title="SpaceTime / Agenda" color="purple">
              <Stat label="Eventos" value={snapshot.spacetime.total} />
              <Stat label="Confirmados" value={snapshot.spacetime.confirmed} />
              <Stat label="Concluídos" value={snapshot.spacetime.done} />
            </SnapshotCard>
          )}

          {snapshot.nasaPlanner && (
            <SnapshotCard title="NASA Planner" color="rose">
              <Stat label="Posts" value={snapshot.nasaPlanner.total} />
              <Stat label="Publicados" value={snapshot.nasaPlanner.published} />
              <Stat label="STARs gastos" value={snapshot.nasaPlanner.starsSpent} />
            </SnapshotCard>
          )}

          {snapshot.metaAds?.spend !== undefined && (
            <SnapshotCard title="Meta Ads" color="blue">
              <Stat
                label="Gasto"
                value={
                  snapshot.metaAds.spend !== undefined
                    ? `R$ ${snapshot.metaAds.spend.toFixed(2)}`
                    : undefined
                }
              />
              <Stat label="Leads" value={snapshot.metaAds.leads} />
              <Stat
                label="CPL"
                value={
                  snapshot.metaAds.cpl !== undefined
                    ? `R$ ${snapshot.metaAds.cpl.toFixed(2)}`
                    : undefined
                }
              />
              <Stat
                label="ROAS"
                value={
                  snapshot.metaAds.roas !== undefined
                    ? `${snapshot.metaAds.roas.toFixed(2)}x`
                    : undefined
                }
              />
            </SnapshotCard>
          )}

          {report.aiNarrative && (
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="font-semibold text-base mb-3">Análise por IA</h2>
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: report.aiNarrative
                    .split("\n")
                    .map((line) => {
                      if (!line.trim()) return "<br/>";
                      const bolded = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
                      return `<p style="margin:4px 0">${bolded}</p>`;
                    })
                    .join(""),
                }}
              />
            </div>
          )}
        </div>

        <footer className="mt-12 pt-6 border-t text-center text-xs text-muted-foreground">
          <p>Powered by NASA Insights</p>
        </footer>
      </div>
    </div>
  );
}

function SnapshotCard({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    emerald: "from-emerald-500 to-green-500",
    sky: "from-sky-500 to-cyan-500",
    amber: "from-amber-500 to-orange-500",
    purple: "from-purple-500 to-violet-500",
    rose: "from-rose-500 to-pink-500",
    blue: "from-blue-500 to-indigo-500",
  };
  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className={`px-5 py-3 bg-gradient-to-r ${colorMap[color] ?? colorMap.emerald} text-white`}>
        <h2 className="font-semibold text-base">{title}</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string | undefined }) {
  if (value === undefined || value === null) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold">{value}</span>
    </div>
  );
}
