import { requireAdminSession } from "@/lib/admin-utils";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Star } from "lucide-react";

interface SearchParams { orgId?: string; type?: string; page?: string }

const TX_TYPES = [
  { value: "PLAN_CREDIT", label: "Crédito Plano" },
  { value: "TOPUP_PURCHASE", label: "Recarga" },
  { value: "APP_CHARGE", label: "Cobrança App" },
  { value: "APP_SETUP", label: "Setup App" },
  { value: "ROLLOVER", label: "Rollover" },
  { value: "MANUAL_ADJUST", label: "Ajuste Manual" },
  { value: "REFUND", label: "Reembolso" },
];

export default async function StarsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminSession();
  const params = await searchParams;
  const filterType = params.type ?? "";
  const filterOrg = params.orgId ?? "";
  const page = Number(params.page ?? 1);
  const limit = 30;

  const where = {
    ...(filterType ? { type: filterType as never } : {}),
    ...(filterOrg ? { organizationId: filterOrg } : {}),
  };

  const [transactions, total, totalsAgg] = await Promise.all([
    prisma.starTransaction.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
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

  const totalPages = Math.ceil(total / limit);
  const txLabel: Record<string, string> = Object.fromEntries(TX_TYPES.map((t) => [t.value, t.label]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-400" /> Stars — Histórico Global
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {total.toLocaleString("pt-BR")} transação(ões) ·
          Total líquido: <span className={totalsAgg._sum.amount ?? 0 >= 0 ? "text-emerald-400" : "text-red-400"}>
            {(totalsAgg._sum.amount ?? 0).toLocaleString("pt-BR")} ⭐
          </span>
        </p>
      </div>

      {/* Filters */}
      <form className="flex gap-3 flex-wrap">
        <select name="type" defaultValue={filterType}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/60">
          <option value="">Todos os tipos</option>
          {TX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button type="submit"
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          Filtrar
        </button>
      </form>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
                <th className="text-left px-5 py-3">Empresa</th>
                <th className="text-left px-5 py-3">Tipo</th>
                <th className="text-right px-5 py-3">Valor</th>
                <th className="text-right px-5 py-3">Saldo após</th>
                <th className="text-left px-5 py-3">Descrição</th>
                <th className="text-right px-5 py-3">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/admin/companies/${tx.organizationId}`}
                      className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
                      {tx.organization.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-full">
                      {txLabel[tx.type] ?? tx.type}
                    </span>
                  </td>
                  <td className={`px-5 py-3 text-right font-semibold ${tx.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-5 py-3 text-right text-zinc-300 text-xs">
                    {tx.balanceAfter.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-5 py-3 text-zinc-400 text-xs max-w-xs truncate">
                    {tx.description}
                  </td>
                  <td className="px-5 py-3 text-right text-zinc-500 text-xs">
                    {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
            <span>Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`?type=${filterType}&page=${page - 1}`} className="px-3 py-1.5 bg-zinc-800 rounded-lg hover:bg-zinc-700">← Anterior</Link>}
              {page < totalPages && <Link href={`?type=${filterType}&page=${page + 1}`} className="px-3 py-1.5 bg-zinc-800 rounded-lg hover:bg-zinc-700">Próxima →</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
