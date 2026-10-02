import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Star, History, Sliders, ListChecks } from "lucide-react";
import { StarsDistributionAdmin } from "@/features/admin/components/stars-distribution-admin";
import { StarsRulesAdmin } from "@/features/admin/components/stars/stars-rules-admin";

interface SearchParams { orgId?: string; type?: string; page?: string; tab?: string }

const TX_TYPES = [
  { value: "PLAN_CREDIT",    label: "Crédito Plano" },
  { value: "TOPUP_PURCHASE", label: "Recarga" },
  { value: "APP_CHARGE",     label: "Cobrança App" },
  { value: "APP_SETUP",      label: "Setup App" },
  { value: "ROLLOVER",       label: "Rollover" },
  { value: "MANUAL_ADJUST",  label: "Ajuste Manual" },
  { value: "REFUND",         label: "Reembolso" },
];

export default async function StarsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminSession();
  const params = await searchParams;
  const tab        = params.tab ?? "history";
  const filterType = params.type  ?? "";
  const filterOrg  = params.orgId ?? "";
  const page       = Number(params.page ?? 1);
  const limit      = 30;

  type TxRow = {
    id: string; type: string; amount: number; balanceAfter: number;
    description: string; appSlug: string | null; createdAt: Date;
    organizationId: string;
    organization: { name: string };
  };

  // Fetch orgs for rules tab
  const allOrgs = tab === "rules"
    ? await prisma.organization.findMany({ select: { id: true, name: true, slug: true, logo: true }, orderBy: { name: "asc" } })
    : ([] as { id: string; name: string; slug: string; logo: string | null }[]);

  // Only fetch transactions when on the history tab
  let transactions: TxRow[] = [];
  let total        = 0;
  let totalPages   = 0;
  let netAmount    = 0;

  if (tab === "history") {
    const where = {
      ...(filterType ? { type: filterType as never } : {}),
      ...(filterOrg  ? { organizationId: filterOrg } : {}),
    };

    const [txs, cnt, agg] = await Promise.all([
      prisma.starTransaction.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, type: true, amount: true, balanceAfter: true,
          description: true, appSlug: true, createdAt: true,
          organizationId: true,
          organization: { select: { name: true } },
        },
      }),
      prisma.starTransaction.count({ where }),
      prisma.starTransaction.aggregate({ _sum: { amount: true } }),
    ]);

    transactions = txs;
    total        = cnt;
    totalPages   = Math.ceil(total / limit);
    netAmount    = agg._sum.amount ?? 0;
  }

  const txLabel: Record<string, string> = Object.fromEntries(TX_TYPES.map((t) => [t.value, t.label]));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Star className="w-5 h-5 text-warning" /> Stars
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie histórico de transações e distribuição de Stars por empresa.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 p-1 bg-panel rounded-full w-fit">
        <Link
          href="?tab=history"
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            tab === "history"
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="size-4" />
          Histórico
        </Link>
        <Link
          href="?tab=distribution"
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            tab === "distribution"
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sliders className="size-4" />
          Distribuição
        </Link>
        <Link
          href="?tab=rules"
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            tab === "rules"
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ListChecks className="size-4" />
          Regras
        </Link>
      </div>

      {/* ── Tab: Histórico ──────────────────────────────────────────────── */}
      {tab === "history" && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString("pt-BR")} transação(ões) ·{" "}
            Total líquido:{" "}
            <span className={netAmount >= 0 ? "text-success" : "text-destructive"}>
              {netAmount.toLocaleString("pt-BR")} ⭐
            </span>
          </p>

          {/* Filters */}
          <form className="flex gap-3 flex-wrap">
            <select name="type" defaultValue={filterType}
              className="bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-info/30">
              <option value="">Todos os tipos</option>
              {TX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input type="hidden" name="tab" value="history" />
            <button type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Filtrar
            </button>
          </form>

          {/* Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs uppercase border-b border-border">
                    <th className="text-left px-5 py-3">Empresa</th>
                    <th className="text-left px-5 py-3">Tipo</th>
                    <th className="text-right px-5 py-3">Valor</th>
                    <th className="text-right px-5 py-3">Saldo após</th>
                    <th className="text-left px-5 py-3">Descrição</th>
                    <th className="text-right px-5 py-3">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`/admin/companies/${tx.organizationId}`}
                          className="text-info hover:text-info font-medium transition-colors">
                          {tx.organization.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs bg-muted text-foreground px-2 py-1 rounded-full">
                          {txLabel[tx.type] ?? tx.type}
                        </span>
                      </td>
                      <td className={`px-5 py-3 text-right font-semibold ${tx.amount > 0 ? "text-success" : "text-destructive"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-5 py-3 text-right text-foreground text-xs">
                        {tx.balanceAfter.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs max-w-xs truncate">
                        {tx.description}
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground text-xs">
                        {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>Página {page} de {totalPages}</span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link href={`?tab=history&type=${filterType}&page=${page - 1}`}
                      className="px-3 py-1.5 bg-muted rounded-lg hover:bg-knob">
                      ← Anterior
                    </Link>
                  )}
                  {page < totalPages && (
                    <Link href={`?tab=history&type=${filterType}&page=${page + 1}`}
                      className="px-3 py-1.5 bg-muted rounded-lg hover:bg-knob">
                      Próxima →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Distribuição ──────────────────────────────────────────── */}
      {tab === "distribution" && (
        <StarsDistributionAdmin />
      )}

      {/* ── Tab: Regras ────────────────────────────────────────────────── */}
      {tab === "rules" && (
        <StarsRulesAdmin allOrgs={allOrgs} />
      )}

    </div>
  );
}
