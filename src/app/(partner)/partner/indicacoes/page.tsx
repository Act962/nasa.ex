import { requirePartnerSession } from "@/features/partner/lib/partner-utils";
import prisma from "@/lib/prisma";
import { Users, AlertTriangle } from "lucide-react";

const ACTIVITY_LABEL = {
  ACTIVE: "Ativa",
  AT_RISK: "Em risco",
  INACTIVE: "Inativa",
} as const;

const ACTIVITY_COLOR = {
  ACTIVE: "bg-success/15 text-success",
  AT_RISK: "bg-warning/15 text-warning",
  INACTIVE: "bg-muted text-muted-foreground",
} as const;

interface Search {
  status?: "ACTIVE" | "AT_RISK" | "INACTIVE" | "";
}

export default async function PartnerReferralsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { user } = await requirePartnerSession();
  const params = await searchParams;
  const filterStatus = params.status ?? "";

  const referrals = await prisma.partnerReferral.findMany({
    where: {
      partnerUserId: user.id,
      ...(filterStatus ? { activityStatus: filterStatus } : {}),
    },
    include: {
      referredOrganization: {
        select: { id: true, name: true, slug: true, logo: true },
      },
    },
    orderBy: { signedUpAt: "desc" },
  });

  const atRiskCount = referrals.filter(
    (r) => r.activityStatus === "AT_RISK",
  ).length;

  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-muted-foreground" />
          Suas indicações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {referrals.length} empresa(s) indicada(s)
        </p>
      </div>

      {atRiskCount > 0 && (
        <div className="bg-warning/15 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning mt-0.5 shrink-0" />
          <div className="text-sm text-warning">
            <p className="font-semibold">
              {atRiskCount} empresa(s) em risco
            </p>
            <p className="text-warning mt-1">
              Engaje essas orgs antes que se tornem inativas — caso contrário,
              seu nível pode cair.
            </p>
          </div>
        </div>
      )}

      <form className="flex gap-3 flex-wrap">
        <select
          name="status"
          defaultValue={filterStatus}
          className="bg-muted border border-line rounded-full px-4 py-2 text-sm text-foreground focus:outline-none focus:border-ring"
        >
          <option value="">Todos status</option>
          <option value="ACTIVE">Ativas</option>
          <option value="AT_RISK">Em risco</option>
          <option value="INACTIVE">Inativas</option>
        </select>
        <button
          type="submit"
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-4 py-2 rounded-full transition-colors"
        >
          Filtrar
        </button>
      </form>

      <div className="bg-card border border-line rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-muted-foreground text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3">Empresa</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-right px-5 py-3">Compras (R$)</th>
              <th className="text-right px-5 py-3">Stars consumidos</th>
              <th className="text-right px-5 py-3">Última atividade</th>
              <th className="text-right px-5 py-3">Cadastrada em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {referrals.map((r) => (
              <tr key={r.id} className="hover:bg-muted/40">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-knob shrink-0 flex items-center justify-center">
                      {r.referredOrganization.logo ? (
                        <img
                          src={r.referredOrganization.logo}
                          alt={r.referredOrganization.name}
                          className="w-8 h-8 rounded-lg object-cover"
                        />
                      ) : null}
                    </div>
                    <div>
                      <div className="text-foreground font-medium">
                        {r.referredOrganization.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.referredOrganization.slug}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACTIVITY_COLOR[r.activityStatus]}`}
                  >
                    {ACTIVITY_LABEL[r.activityStatus]}
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-foreground">
                  R$ {fmt(Number(r.totalPurchasedBrl))}
                </td>
                <td className="px-5 py-3 text-right text-warning">
                  {r.totalStarsConsumed.toLocaleString("pt-BR")}
                </td>
                <td className="px-5 py-3 text-right text-muted-foreground text-xs">
                  {r.lastQualifyingActivityAt
                    ? new Date(r.lastQualifyingActivityAt).toLocaleDateString(
                        "pt-BR",
                      )
                    : "—"}
                </td>
                <td className="px-5 py-3 text-right text-muted-foreground text-xs">
                  {new Date(r.signedUpAt).toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
            {referrals.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center text-muted-foreground text-sm"
                >
                  Nenhuma indicação encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
