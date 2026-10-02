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
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <History className="w-5 h-5 text-muted-foreground" />
          Histórico de Níveis
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Linha do tempo das mudanças de nível no programa.
        </p>
      </div>

      <div className="bg-card border border-line rounded-xl overflow-hidden">
        <ul className="divide-y divide-line">
          {history.map((h) => {
            const isUp =
              h.reason === "auto_upgrade" || h.reason === "first_activation";
            return (
              <li key={h.id} className="px-5 py-4 flex items-center gap-4">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isUp
                      ? "bg-success/15 text-success"
                      : "bg-warning/15 text-warning"
                  }`}
                >
                  {isUp ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-foreground font-medium">
                    {h.fromTier ?? "—"} → {h.toTier ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {REASON_LABEL[h.reason] ?? h.reason} ·{" "}
                    {h.activeReferrals} org(s) ativa(s) no momento
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(h.createdAt).toLocaleDateString("pt-BR")}
                </div>
              </li>
            );
          })}
          {history.length === 0 && (
            <li className="px-5 py-10 text-center text-muted-foreground text-sm">
              Nenhuma mudança de nível registrada ainda.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
