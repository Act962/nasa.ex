import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { FileBarChart2, Calendar, User as UserIcon } from "lucide-react";
import { PublicReportClient } from "@/features/insights/components/reports/public-report-client";

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

  const snapshot = (report.snapshot ?? {}) as Record<string, unknown>;
  const modules = (report.modules ?? []) as string[];
  const period = snapshot.period as
    | { startDate?: string; endDate?: string }
    | undefined;
  const periodLabel =
    period?.startDate && period?.endDate
      ? `${new Date(period.startDate).toLocaleDateString("pt-BR")} a ${new Date(
          period.endDate,
        ).toLocaleDateString("pt-BR")}`
      : "Período não informado";

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white dark:from-violet-950/20 dark:to-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
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

        <PublicReportClient snapshot={snapshot} modules={modules} />

        {report.aiNarrative && (
          <div className="rounded-2xl border bg-card p-6 mt-6">
            <h2 className="font-semibold text-base mb-3">Análise por IA</h2>
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: report.aiNarrative
                  .split("\n")
                  .map((line) => {
                    if (!line.trim()) return "<br/>";
                    const bolded = line.replace(
                      /\*\*(.+?)\*\*/g,
                      "<strong>$1</strong>",
                    );
                    return `<p style="margin:4px 0">${bolded}</p>`;
                  })
                  .join(""),
              }}
            />
          </div>
        )}

        <footer className="mt-12 pt-6 border-t text-center text-xs text-muted-foreground">
          <p>Powered by NASA Insights</p>
        </footer>
      </div>
    </div>
  );
}
