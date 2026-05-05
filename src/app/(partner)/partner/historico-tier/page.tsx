import { requirePartnerSession } from "@/features/partner/lib/partner-utils";
import prisma from "@/lib/prisma";
import { History, ArrowUpRight, ArrowDownRight } from "lucide-react";

const REASON_LABEL: Record<string, string> = {
  auto_upgrade: "Promoção automática",
  first_activation: "Ativação inicial",
  auto_downgrade: "Rebaixamento automático",
  admin_manual: "Ação do administrador",
  grace_started: "Início de carência",
  grace_expired: "Carência expirou",
  grace_continues: "Carência em andamento",
  no_change: "Sem alteração",
};

export default async function PartnerTierHistoryPage() {
  const { partner } = await requirePartnerSession();

  const history = await prisma.partnerTierHistory.findMany({
    where: { partnerId: partner.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <History className="w-5 h-5 text-amber-400" />
          Histórico de Níveis
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Linha do tempo das mudanças de nível no programa.
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <ul className="divide-y divide-zinc-800">
          {history.map((h) => {
            const isUp =
              h.reason === "auto_upgrade" || h.reason === "first_activation";
            return (
              <li key={h.id} className="px-5 py-4 flex items-center gap-4">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isUp
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {isUp ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-white font-medium">
                    {h.fromTier ?? "—"} → {h.toTier ?? "—"}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {REASON_LABEL[h.reason] ?? h.reason} ·{" "}
                    {h.activeReferrals} org(s) ativa(s) no momento
                  </div>
                </div>
                <div className="text-xs text-zinc-500">
                  {new Date(h.createdAt).toLocaleDateString("pt-BR")}
                </div>
              </li>
            );
          })}
          {history.length === 0 && (
            <li className="px-5 py-10 text-center text-zinc-500 text-sm">
              Nenhuma mudança de nível registrada ainda.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
