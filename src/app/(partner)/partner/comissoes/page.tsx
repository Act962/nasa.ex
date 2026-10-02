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
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-muted-foreground" />
          Comissões e Repasses
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Histórico de comissões geradas e payouts agendados.
        </p>
      </div>

      <section className="bg-card border border-line rounded-xl overflow-hidden">
        <header className="px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Repasses (últimos 12)
          </h2>
        </header>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-muted-foreground text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-2">Ciclo</th>
              <th className="text-left px-5 py-2">Repasse em</th>
              <th className="text-right px-5 py-2">Bruto</th>
              <th className="text-right px-5 py-2">Taxa</th>
              <th className="text-right px-5 py-2">Líquido</th>
              <th className="text-right px-5 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {payouts.map((p) => (
              <tr key={p.id} className="hover:bg-muted/40">
                <td className="px-5 py-2 text-foreground">{p.cycleYearMonth}</td>
                <td className="px-5 py-2 text-muted-foreground text-xs">
                  {new Date(p.scheduledFor).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-5 py-2 text-right text-foreground">
                  R$ {fmt(Number(p.grossBrl))}
                </td>
                <td className="px-5 py-2 text-right text-destructive">
                  -R$ {fmt(Number(p.advanceFeeBrl))}
                </td>
                <td className="px-5 py-2 text-right text-success font-semibold">
                  R$ {fmt(Number(p.netBrl))}
                </td>
                <td className="px-5 py-2 text-right text-xs">{p.status}</td>
              </tr>
            ))}
            {payouts.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-8 text-center text-muted-foreground text-sm"
                >
                  Sem repasses ainda. O primeiro será agendado no fechamento do
                  próximo ciclo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="bg-card border border-line rounded-xl overflow-hidden">
        <header className="px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Comissões (últimas 50)
          </h2>
        </header>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-muted-foreground text-xs uppercase tracking-wider">
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
          <tbody className="divide-y divide-line">
            {commissions.map((c) => (
              <tr key={c.id} className="hover:bg-muted/40">
                <td className="px-5 py-2 text-foreground text-xs">
                  {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-5 py-2 text-foreground">{c.organization.name}</td>
                <td
                  className="px-5 py-2 text-muted-foreground text-xs"
                  title={`R$ ${Number(c.unitPriceBrlSnapshot).toFixed(4)} por STAR no momento`}
                >
                  {c.packageLabelSnapshot}
                </td>
                <td className="px-5 py-2 text-right text-warning">
                  {c.starsAmountSnapshot.toLocaleString("pt-BR")} ⭐
                </td>
                <td className="px-5 py-2 text-right text-foreground">
                  R$ {fmt(Number(c.basePaymentBrl))}
                </td>
                <td className="px-5 py-2 text-right text-muted-foreground">
                  {Number(c.ratePercent)}%
                </td>
                <td className="px-5 py-2 text-right text-success font-semibold">
                  R$ {fmt(Number(c.commissionBrl))}
                </td>
                <td className="px-5 py-2 text-right text-xs">{c.status}</td>
              </tr>
            ))}
            {commissions.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-8 text-center text-muted-foreground text-sm"
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
