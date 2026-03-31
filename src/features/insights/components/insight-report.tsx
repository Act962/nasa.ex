"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Download, Loader2, FileText, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";
import type { AppModule } from "./app-selector";

interface InsightReportProps {
  selectedModules: AppModule[];
  period: { startDate?: string; endDate?: string };
  orgName: string;
  tracking?: {
    totalLeads: number; wonLeads: number; activeLeads: number; conversionRate: number;
  };
  chat?: {
    totalConversations: number; totalMessages: number;
    attendedConversations: number; unattendedConversations: number; attendanceRate: number;
  };
  forge?: {
    totalProposals: number; rascunho: number; enviadas: number; visualizadas: number;
    pagas: number; expiradas: number; canceladas: number;
    revenueTotal: number; revenuePipeline: number;
    totalContracts: number; contractsAtivo: number;
  };
  spacetime?: {
    total: number; pending: number; confirmed: number; done: number;
    cancelled: number; noShow: number; withLead: number; conversionRate: number;
  };
  nasaPlanner?: {
    total: number; draft: number; published: number; scheduled: number;
    starsSpent: number; byNetwork: Record<string, number>;
  };
  metaAds?: {
    spend?: number; roas?: number; leads?: number;
    clicks?: number; impressions?: number; ctr?: number; cpl?: number;
  };
}

function formatPeriod(start?: string, end?: string) {
  if (!start || !end) return "Período selecionado";
  return `${new Date(start).toLocaleDateString("pt-BR")} a ${new Date(end).toLocaleDateString("pt-BR")}`;
}

function parsedToHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "<br/>";
      // **bold**
      line = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      // numbered lists
      if (/^\d+\./.test(line.trim())) return `<p style="margin:6px 0 6px 16px">${line.trim()}</p>`;
      // bullet
      if (/^[-•]/.test(line.trim())) return `<p style="margin:4px 0 4px 16px">${line.trim().replace(/^[-•]\s*/, "• ")}</p>`;
      return `<p style="margin:4px 0">${line}</p>`;
    })
    .join("");
}

async function downloadPDF(reportText: string, orgName: string, period: string, modules: string[]) {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const marginL = 18;
  const marginR = 18;
  const maxW = W - marginL - marginR;
  let y = 0;

  function addPage() {
    doc.addPage();
    y = 18;
  }

  function checkY(needed = 10) {
    if (y + needed > 275) addPage();
  }

  // ── Header bar ────────────────────────────────────────────────────────────
  doc.setFillColor(15, 15, 20);
  doc.rect(0, 0, W, 28, "F");

  // Logo text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("NASA", marginL, 17);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(160, 160, 180);
  doc.text("by NASA Explorer", marginL + 22, 17);

  // Org + period top right
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 200);
  doc.text(orgName, W - marginR, 12, { align: "right" });
  doc.text(period, W - marginR, 18, { align: "right" });

  y = 38;

  // ── Title ─────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 15, 20);
  doc.text("Relatório de Análise", marginL, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 120);
  doc.text(`Apps: ${modules.join(" · ")}  |  ${period}`, marginL, y);
  y += 5;

  // Divider
  doc.setDrawColor(220, 220, 230);
  doc.setLineWidth(0.4);
  doc.line(marginL, y, W - marginR, y);
  y += 10;

  // ── Report body ───────────────────────────────────────────────────────────
  const lines = reportText.split("\n");

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { y += 3; continue; }

    // Section heading (starts with **)
    if (line.startsWith("**") && line.endsWith("**")) {
      checkY(14);
      const heading = line.replace(/\*\*/g, "");
      y += 4;
      doc.setFillColor(245, 245, 252);
      doc.roundedRect(marginL - 2, y - 5, maxW + 4, 9, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 120);
      doc.text(heading, marginL + 1, y);
      y += 7;
      continue;
    }

    // Inline bold stripping for body text
    const cleaned = line.replace(/\*\*(.+?)\*\*/g, "$1");
    const isBullet = /^[-•\d]/.test(cleaned);

    doc.setFont("helvetica", isBullet ? "normal" : "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 55);

    const indent = isBullet ? marginL + 4 : marginL;
    const wrapped = doc.splitTextToSize(cleaned, maxW - (isBullet ? 4 : 0));

    checkY(wrapped.length * 5 + 2);
    doc.text(wrapped, indent, y);
    y += wrapped.length * 5 + 1;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 180);
    doc.text(`NASA Explorer · ${orgName} · ${period}`, marginL, 291);
    doc.text(`Página ${i} de ${pageCount}`, W - marginR, 291, { align: "right" });
    doc.setDrawColor(220, 220, 230);
    doc.setLineWidth(0.3);
    doc.line(marginL, 287, W - marginR, 287);
  }

  const filename = `relatorio-${orgName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.pdf`;
  doc.save(filename);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InsightReport({
  selectedModules,
  period,
  orgName,
  tracking,
  chat,
  forge,
  spacetime,
  nasaPlanner,
  metaAds,
}: InsightReportProps) {
  const [report, setReport] = useState<string>("");
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const { mutate: generateReport, isPending } = useMutation({
    mutationFn: () =>
      orpc.insights.generateReport.call({
        period,
        modules: selectedModules,
        tracking: tracking ?? undefined,
        chat: chat ?? undefined,
        forge: forge ?? undefined,
        spacetime: spacetime ?? undefined,
        nasaPlanner: nasaPlanner ?? undefined,
        metaAds: metaAds?.spend !== undefined
          ? {
              spend: metaAds.spend ?? 0,
              roas: metaAds.roas ?? 0,
              leads: metaAds.leads ?? 0,
              clicks: metaAds.clicks ?? 0,
              impressions: metaAds.impressions ?? 0,
              ctr: metaAds.ctr ?? 0,
              cpl: metaAds.cpl ?? 0,
            }
          : undefined,
      }),
    onSuccess: (data) => setReport(data.report),
  });

  const periodStr = formatPeriod(period.startDate, period.endDate);

  const handleDownload = async () => {
    setIsPdfLoading(true);
    try {
      const moduleLabels: Record<string, string> = {
        tracking: "Tracking",
        chat: "Chat",
        forge: "Forge",
        spacetime: "SpaceTime",
        "nasa-planner": "NASA Planner",
        integrations: "Integrações",
      };
      const moduleNames = selectedModules.map((m) => moduleLabels[m] ?? m);
      await downloadPDF(report || "Sem relatório gerado.", orgName, periodStr, moduleNames);
    } finally {
      setIsPdfLoading(false);
    }
  };

  return (
    <div className="w-full rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center">
            <FileText className="size-4 text-violet-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Relatório da Análise</h2>
            <p className="text-[11px] text-muted-foreground">{periodStr} · {orgName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {report && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isPdfLoading}
              className="gap-1.5 text-xs"
            >
              {isPdfLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              Baixar PDF
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => generateReport()}
            disabled={isPending}
            className="gap-1.5 text-xs bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0"
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : report ? (
              <RefreshCw className="size-3.5" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {isPending ? "Gerando..." : report ? "Regerar" : "Gerar por IA"}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 min-h-[120px]">
        {!report && !isPending && (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center">
              <Sparkles className="size-5 text-violet-500" />
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">
              Clique em <strong>Gerar por IA</strong> para receber uma análise profissional
              dos seus dados consolidados, com insights e recomendações estratégicas.
            </p>
          </div>
        )}

        {isPending && (
          <div className="flex items-center gap-3 py-8 justify-center">
            <Loader2 className="size-5 text-violet-500 animate-spin" />
            <p className="text-sm text-muted-foreground">Analisando dados com IA...</p>
          </div>
        )}

        {report && !isPending && (
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: parsedToHtml(report) }}
          />
        )}
      </div>
    </div>
  );
}
