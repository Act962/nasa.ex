import { requirePartnerSession } from "@/features/partner/lib/partner-utils";
import prisma from "@/lib/prisma";
import { Users, AlertTriangle } from "lucide-react";

const ACTIVITY_LABEL = {
  ACTIVE: "Ativa",
  AT_RISK: "Em risco",
  INACTIVE: "Inativa",
} as const;

const ACTIVITY_COLOR = {
  ACTIVE: "bg-emerald-500/15 text-emerald-300",
  AT_RISK: "bg-amber-500/15 text-amber-300",
  INACTIVE: "bg-zinc-700 text-zinc-300",
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
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-400" />
          Suas indicações
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {referrals.length} empresa(s) indicada(s)
        </p>
      </div>

      {atRiskCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-200">
            <p className="font-semibold">
              {atRiskCount} empresa(s) em risco
            </p>
            <p className="text-amber-300/80 mt-1">
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
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/60"
        >
          <option value="">Todos status</option>
          <option value="ACTIVE">Ativas</option>
          <option value="AT_RISK">Em risco</option>
          <option value="INACTIVE">Inativas</option>
        </select>
        <button
          type="submit"
          className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Filtrar
        </button>
      </form>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3">Empresa</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-right px-5 py-3">Compras (R$)</th>
              <th className="text-right px-5 py-3">Stars consumidos</th>
              <th className="text-right px-5 py-3">Última atividade</th>
              <th className="text-right px-5 py-3">Cadastrada em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {referrals.map((r) => (
              <tr key={r.id} className="hover:bg-zinc-800/40">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-700 shrink-0 flex items-center justify-center">
                      {r.referredOrganization.logo ? (
                        <img
                          src={r.referredOrganization.logo}
                          alt={r.referredOrganization.name}
                          className="w-8 h-8 rounded-lg object-cover"
                        />
                      ) : null}
                    </div>
                    <div>
                      <div className="text-white font-medium">
                        {r.referredOrganization.name}
                      </div>
                      <div className="text-[11px] text-zinc-500">
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
                <td className="px-5 py-3 text-right text-zinc-300">
                  R$ {fmt(Number(r.totalPurchasedBrl))}
                </td>
                <td className="px-5 py-3 text-right text-yellow-400">
                  {r.totalStarsConsumed.toLocaleString("pt-BR")}
                </td>
                <td className="px-5 py-3 text-right text-zinc-400 text-xs">
                  {r.lastQualifyingActivityAt
                    ? new Date(r.lastQualifyingActivityAt).toLocaleDateString(
                        "pt-BR",
                      )
                    : "—"}
                </td>
                <td className="px-5 py-3 text-right text-zinc-500 text-xs">
                  {new Date(r.signedUpAt).toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
            {referrals.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center text-zinc-500 text-sm"
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
