import Link from "next/link";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { InsightsTabsNav } from "@/features/insights/components/insights-tabs-nav";
import { ReportsList } from "@/features/insights/components/reports/reports-list";
import { AstroPromptBar } from "@/features/insights/components/astro/astro-prompt-bar";
import { CampaignsEvolution } from "@/features/insights/components/reports/campaigns-evolution";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, BarChart3, TrendingUp } from "lucide-react";

export default function RelatoriosPage() {
  return (
    <div className="flex flex-col h-full w-full">
      <HeaderTracking title="Insights" />
      <InsightsTabsNav />
      <div className="flex-1 overflow-auto px-4 sm:px-6 py-6 max-w-7xl mx-auto w-full space-y-6">
        <AstroPromptBar
          context="insights"
          placeholder="Pergunte ao Astro sobre suas campanhas Meta… (ex: 'pausa minha campanha de Black Friday')"
        />
        <div>
      <div className="flex-1 overflow-auto px-4 sm:px-6 py-6 max-w-7xl mx-auto w-full space-y-8">
        {/* Modelos de relatório */}
        <section>
          <div className="mb-3">
            <h2 className="text-xl font-bold">Modelos</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Templates prontos para análise rápida — abrem com dados ao vivo
              da sua conta.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Link
              href="/insights/relatorios/trafego-meta"
              className="group focus:outline-none focus:ring-2 focus:ring-primary rounded-xl"
            >
              <Card className="h-full transition-colors group-hover:border-primary">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="p-2 rounded-lg bg-[#0082FB]/10 text-[#0082FB]">
                      <BarChart3 className="size-4" />
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <h3 className="font-semibold text-sm">
                    Análise de desempenho — Tráfego Meta
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    KPIs gerais, comparação com período anterior, quebra por
                    campanha e anúncios em destaque. Modelo padrão para
                    relatórios de tráfego pago.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        {/* Evolução de campanhas */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="size-5 text-violet-600" />
            <div>
              <h2 className="text-xl font-bold">Evolução de campanhas</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Compare a evolução das campanhas Meta entre relatórios salvos.
                Cada ponto = um snapshot.
              </p>
            </div>
          </div>
          <CampaignsEvolution />
        </section>

        {/* Relatórios salvos */}
        <section>
          <div className="mb-3">
            <h2 className="text-xl font-bold">Relatórios salvos</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Snapshots congelados dos seus dashboards. Compartilhe via link
              público ou compare com relatórios anteriores.
            </p>
          </div>
          <ReportsList />
        </div>
        </section>
      </div>
    </div>
  );
}
