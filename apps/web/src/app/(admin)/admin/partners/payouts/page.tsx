import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Calendar } from "lucide-react";

export default async function PartnerPayoutsPage() {
  await requireAdminSession();

  const payouts = await prisma.partnerPayout.findMany({
    where: { status: { in: ["SCHEDULED", "ADVANCED"] } },
    orderBy: { scheduledFor: "asc" },
    include: {
      partner: {
        select: {
          id: true,
          tier: true,
          user: { select: { name: true, email: true } },
        },
      },
      _count: { select: { commissions: true } },
    },
  });

  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  const totalGross = payouts.reduce((s, p) => s + Number(p.grossBrl), 0);
  const totalNet = payouts.reduce((s, p) => s + Number(p.netBrl), 0);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/partners"
          className="text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" /> Voltar para Parceiros
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" /> Fila de Repasses
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {payouts.length} payout(s) aguardando — bruto R${" "}
            {fmt(totalGross)} · líquido R$ {fmt(totalNet)}
          </p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3">Parceiro</th>
              <th className="text-left px-5 py-3">Nível</th>
              <th className="text-left px-5 py-3">Ciclo</th>
              <th className="text-left px-5 py-3">
                <Calendar className="w-3 h-3 inline mr-1" /> Repasse em
              </th>
              <th className="text-right px-5 py-3">Bruto</th>
              <th className="text-right px-5 py-3">Taxa</th>
              <th className="text-right px-5 py-3">Líquido</th>
              <th className="text-right px-5 py-3">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {payouts.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-800/40">
                <td className="px-5 py-3">
                  <div className="text-white font-medium">{p.partner.user.name}</div>
                  <div className="text-[11px] text-zinc-500">
                    {p.partner.user.email}
                  </div>
                </td>
                <td className="px-5 py-3 text-amber-300 text-xs">
                  {p.partner.tier ?? "—"}
                </td>
                <td className="px-5 py-3 text-zinc-300">{p.cycleYearMonth}</td>
                <td className="px-5 py-3 text-zinc-400 text-xs">
                  {new Date(p.scheduledFor).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-5 py-3 text-right text-zinc-300">
                  R$ {fmt(Number(p.grossBrl))}
                </td>
                <td className="px-5 py-3 text-right text-rose-300">
                  -R$ {fmt(Number(p.advanceFeeBrl))}
                </td>
                <td className="px-5 py-3 text-right text-emerald-400 font-semibold">
                  R$ {fmt(Number(p.netBrl))}
                </td>
                <td className="px-5 py-3 text-right">
                  <span
                    className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                      p.status === "ADVANCED"
                        ? "bg-purple-500/20 text-purple-300"
                        : "bg-blue-500/20 text-blue-300"
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/admin/partners/${p.partner.id}`}
                    className="text-xs text-amber-400 hover:text-amber-300"
                  >
                    Ver parceiro
                  </Link>
                </td>
              </tr>
            ))}
            {payouts.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-5 py-10 text-center text-zinc-500 text-sm"
                >
                  Nenhum payout pendente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
