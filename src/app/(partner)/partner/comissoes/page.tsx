import { requirePartnerSession } from "@/features/partner/lib/partner-utils";
import prisma from "@/lib/prisma";
import { TrendingUp } from "lucide-react";

export default async function PartnerCommissionsPage() {
  const { partner } = await requirePartnerSession();

  const [commissions, payouts] = await Promise.all([
    prisma.partnerCommission.findMany({
      where: { partnerId: partner.id },
      include: { organization: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.partnerPayout.findMany({
      where: { partnerId: partner.id },
      orderBy: { scheduledFor: "desc" },
      take: 12,
    }),
  ]);

  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-amber-400" />
          Comissões e Repasses
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Histórico de comissões geradas e payouts agendados.
        </p>
      </div>

      <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <header className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            Repasses (últimos 12)
          </h2>
        </header>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-2">Ciclo</th>
              <th className="text-left px-5 py-2">Repasse em</th>
              <th className="text-right px-5 py-2">Bruto</th>
              <th className="text-right px-5 py-2">Taxa</th>
              <th className="text-right px-5 py-2">Líquido</th>
              <th className="text-right px-5 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {payouts.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-800/40">
                <td className="px-5 py-2 text-white">{p.cycleYearMonth}</td>
                <td className="px-5 py-2 text-zinc-400 text-xs">
                  {new Date(p.scheduledFor).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-5 py-2 text-right text-zinc-300">
                  R$ {fmt(Number(p.grossBrl))}
                </td>
                <td className="px-5 py-2 text-right text-rose-300">
                  -R$ {fmt(Number(p.advanceFeeBrl))}
                </td>
                <td className="px-5 py-2 text-right text-emerald-400 font-semibold">
                  R$ {fmt(Number(p.netBrl))}
                </td>
                <td className="px-5 py-2 text-right text-xs">{p.status}</td>
              </tr>
            ))}
            {payouts.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-8 text-center text-zinc-500 text-sm"
                >
                  Sem repasses ainda. O primeiro será agendado no fechamento do
                  próximo ciclo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <header className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            Comissões (últimas 50)
          </h2>
        </header>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-2">Data</th>
              <th className="text-left px-5 py-2">Org indicada</th>
              <th className="text-left px-5 py-2">Pacote</th>
              <th className="text-right px-5 py-2">Stars</th>
              <th className="text-right px-5 py-2">Pago</th>
              <th className="text-right px-5 py-2">%</th>
              <th className="text-right px-5 py-2">Comissão</th>
              <th className="text-right px-5 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {commissions.map((c) => (
              <tr key={c.id} className="hover:bg-zinc-800/40">
                <td className="px-5 py-2 text-zinc-300 text-xs">
                  {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-5 py-2 text-white">{c.organization.name}</td>
                <td
                  className="px-5 py-2 text-zinc-400 text-xs"
                  title={`R$ ${Number(c.unitPriceBrlSnapshot).toFixed(4)} por STAR no momento`}
                >
                  {c.packageLabelSnapshot}
                </td>
                <td className="px-5 py-2 text-right text-yellow-400">
                  {c.starsAmountSnapshot.toLocaleString("pt-BR")} ⭐
                </td>
                <td className="px-5 py-2 text-right text-zinc-300">
                  R$ {fmt(Number(c.basePaymentBrl))}
                </td>
                <td className="px-5 py-2 text-right text-zinc-400">
                  {Number(c.ratePercent)}%
                </td>
                <td className="px-5 py-2 text-right text-emerald-400 font-semibold">
                  R$ {fmt(Number(c.commissionBrl))}
                </td>
                <td className="px-5 py-2 text-right text-xs">{c.status}</td>
              </tr>
            ))}
            {commissions.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-8 text-center text-zinc-500 text-sm"
                >
                  Nenhuma comissão gerada ainda. Quando suas orgs indicadas
                  comprarem STARs, a comissão aparecerá aqui.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
