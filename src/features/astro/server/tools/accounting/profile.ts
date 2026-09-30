import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { REGIME_LABELS, REGIME_TERM_IDS } from "@/features/accounting/lib/profile/tax-display";
import { computeEffectiveRate } from "@/features/accounting/lib/pricing/compute-effective-rate";
import { formatBps, formatCentsBrl, shiftMonthKey } from "@/features/accounting/lib/format";
import { toEffectiveRateProfile } from "@/features/accounting/server/profile/tax-profile";
import { loadTaxRates } from "@/features/accounting/server/tax-rates/load-tax-rates";
import { loadRbt12 } from "@/features/accounting/server/revenue/load-revenue";
import { assertAccountingReadAccess, ACCOUNTING_TAB_URL } from "./access";
import { currentMonthKey, loadExistingTaxProfile, PROFILE_MISSING_MESSAGE, toCalculationPayload } from "./shared";

export function buildAccountingProfileTools(ctx: AgentContext) {
  return {
    get_tax_profile: tool({
      description:
        "PERFIL FISCAL da empresa (aba Contábil): regime tributário (MEI, Simples Nacional, Lucro Presumido, Lucro Real), CNAE, anexo do Simples, se está sujeita ao Fator R, folha dos últimos 12 meses, UF/município, inscrições, se tem funcionários, se é contribuinte de ICMS/ISS, opção de recolher IBS/CBS por fora do Simples e se o cadastro fiscal foi concluído. Também devolve o RBT12 atual e a ALÍQUOTA EFETIVA estimada sobre venda de serviço e de produto, com a memória de cálculo. Use antes de qualquer resposta que dependa do regime ('quanto pago de imposto', 'qual meu anexo', 'estou no Simples?', 'qual minha alíquota').",
      inputSchema: z.object({}),
      execute: async () => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };

        const profile = await loadExistingTaxProfile(ctx.organizationId);
        if (!profile) return { configured: false, message: PROFILE_MISSING_MESSAGE, url: `${ACCOUNTING_TAB_URL}&sub=profile` };

        const periodMonth = currentMonthKey();
        const rbt12 = await loadRbt12({ organizationId: ctx.organizationId, periodMonth, openedAt: profile.openedAt });
        const rates = await loadTaxRates(ctx.organizationId);
        const effectiveRateProfile = toEffectiveRateProfile(profile);
        const at = new Date();
        const serviceRate = computeEffectiveRate({ profile: effectiveRateProfile, rbt12Cents: rbt12.rbt12Cents, kind: "SERVICE", rates, at });
        const productRate = computeEffectiveRate({ profile: effectiveRateProfile, rbt12Cents: rbt12.rbt12Cents, kind: "PRODUCT", rates, at });

        return {
          configured: true,
          isOnboardingComplete: profile.onboardingCompletedAt !== null,
          regime: profile.regime,
          regimeLabel: REGIME_LABELS[profile.regime],
          regimeGlossaryTermId: REGIME_TERM_IDS[profile.regime],
          cnaePrincipal: profile.cnaePrincipal,
          cnaesSecundarios: profile.cnaesSecundarios,
          simplesAnnex: profile.simplesAnnex,
          isFatorRSubject: profile.isFatorRSubject,
          payroll12m: formatCentsBrl(profile.payroll12mCents),
          uf: profile.uf,
          municipioIbge: profile.municipioIbge,
          hasStateRegistration: Boolean(profile.stateRegistration),
          hasMunicipalRegistration: Boolean(profile.municipalRegistration),
          hasEmployees: profile.hasEmployees,
          isIcmsContributor: profile.isIcmsContributor,
          isIssContributor: profile.isIssContributor,
          issRate: profile.issRateBps !== null ? formatBps(profile.issRateBps) : null,
          presumedIrpjBase: formatBps(profile.presumedIrpjBaseBps),
          presumedCsllBase: formatBps(profile.presumedCsllBaseBps),
          ibsCbsOutsideSimples: profile.ibsCbsOutsideSimples,
          alertPhonesCount: profile.alertPhones.length,
          rbt12: {
            referenceMonth: periodMonth,
            window: `${shiftMonthKey(periodMonth, -12)} a ${shiftMonthKey(periodMonth, -1)}`,
            value: formatCentsBrl(rbt12.rbt12Cents),
            rbt12Cents: rbt12.rbt12Cents,
            isProportional: rbt12.isProportional,
          },
          effectiveRateOnServices: { rate: formatBps(serviceRate.output.rateBps), ...toCalculationPayload(serviceRate) },
          effectiveRateOnProducts: { rate: formatBps(productRate.output.rateBps), ...toCalculationPayload(productRate) },
          url: `${ACCOUNTING_TAB_URL}&sub=profile`,
        };
      },
    }),
  };
}
