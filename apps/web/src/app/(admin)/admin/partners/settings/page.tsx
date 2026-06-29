import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import { getProgramSettings } from "@/features/partner/lib/partner-service";
import Link from "next/link";
import { ArrowLeft, Settings as SettingsIcon } from "lucide-react";

export default async function PartnerSettingsPage() {
  await requireAdminSession();
  const s = await getProgramSettings();

  const TIERS: Array<{
    key: string;
    label: string;
    threshold: number;
    commission: number;
    discount: number;
  }> = [
    {
      key: "SUITE",
      label: "Suite",
      threshold: s.suiteThreshold,
      commission: s.suiteCommissionRate.toNumber(),
      discount: s.suiteDiscountRate.toNumber(),
    },
    {
      key: "EARTH",
      label: "Earth",
      threshold: s.earthThreshold,
      commission: s.earthCommissionRate.toNumber(),
      discount: s.earthDiscountRate.toNumber(),
    },
    {
      key: "GALAXY",
      label: "Galaxy",
      threshold: s.galaxyThreshold,
      commission: s.galaxyCommissionRate.toNumber(),
      discount: s.galaxyDiscountRate.toNumber(),
    },
    {
      key: "CONSTELLATION",
      label: "Constellation",
      threshold: s.constellationThreshold,
      commission: s.constellationCommissionRate.toNumber(),
      discount: s.constellationDiscountRate.toNumber(),
    },
    {
      key: "INFINITY",
      label: "Infinity",
      threshold: s.infinityThreshold,
      commission: s.infinityCommissionRate.toNumber(),
      discount: s.infinityDiscountRate.toNumber(),
    },
  ];

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

      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-amber-400" />
          Configurações do Programa
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Limites de nível, taxas de comissão e desconto, regras de qualificação
          contínua.
        </p>
      </div>

      <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <header className="px-5 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white">Níveis</h2>
          <p className="text-xs text-zinc-500">
            Limite mínimo de orgs ativas · % comissão · % desconto na compra
          </p>
        </header>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
              <th className="text-left px-5 py-2">Nível</th>
              <th className="text-right px-5 py-2">Mín. orgs ativas</th>
              <th className="text-right px-5 py-2">Comissão (%)</th>
              <th className="text-right px-5 py-2">Desconto (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {TIERS.map((t) => (
              <tr key={t.key} className="hover:bg-zinc-800/40">
                <td className="px-5 py-2 text-white font-medium">{t.label}</td>
                <td className="px-5 py-2 text-right text-zinc-300">
                  {t.threshold}
                </td>
                <td className="px-5 py-2 text-right text-emerald-400">
                  {t.commission}%
                </td>
                <td className="px-5 py-2 text-right text-purple-300">
                  {t.discount}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">
          Ciclo de pagamento e antecipação
        </h2>
        <Row
          label="Dia do mês para repasse"
          value={s.payoutDayOfMonth.toString()}
        />
        <Row
          label="Taxa de antecipação"
          value={`${s.advanceFeePercent.toNumber()}%`}
        />
        <Row
          label="Antecipação só com >= dias de antecedência"
          value={`${s.advanceMinDaysBefore} dias`}
        />
      </section>

      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">
          Qualificação contínua de parceiro
        </h2>
        <Row
          label="Janela para considerar org ativa"
          value={`${s.activeOrgWindowDays} dias`}
        />
        <Row
          label="Compra mínima na janela (R$)"
          value={`R$ ${s.activeOrgMinPurchaseBrl.toFixed(2)}`}
        />
        <Row
          label="Stars mínimos consumidos na janela"
          value={`${s.activeOrgMinStarsConsumed}`}
        />
        <Row
          label="Aviso de risco (dias antes da expiração)"
          value={`${s.atRiskWarningDays} dias`}
        />
        <Row
          label="Carência de downgrade"
          value={`${s.downgradeGracePeriodDays} dias`}
        />
        <Row
          label="Cadência de recálculo de nível"
          value={`${s.tierRecalcCadenceDays} dia(s)`}
        />
      </section>

      <p className="text-xs text-zinc-500">
        ✏️ Edição inline será adicionada na próxima iteração — por enquanto,
        ajustes via Prisma Studio ou API <code>admin.partners.updateSettings</code>.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm border-t border-zinc-800/50 first:border-t-0 pt-2 first:pt-0">
      <span className="text-zinc-400">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}
