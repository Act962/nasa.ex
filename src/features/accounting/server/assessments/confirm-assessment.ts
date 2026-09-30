import "server-only";

import prisma from "@/lib/prisma";
import type { TaxKind } from "@/generated/prisma/client";
import { createPaymentEntryRecord } from "@/features/payment/server/entries/create-entry";
import type { PaymentActor } from "@/features/payment/server/entries/entry-include";
import { formatCentsBrl, quarterMonths } from "@/features/accounting/lib/format";
import { TAX_LABELS } from "./assess-period";

// Confirmar uma apuração gera a guia como conta a pagar. A partir daí ela
// herda lembrete, régua, conciliação e o aviso de vencimento pelo WhatsApp.

const TAX_CATEGORY_NAME = "Impostos e taxas";

/** Tributo → obrigação do calendário que a guia quita. */
export const TAX_OBLIGATION_KIND: Partial<Record<TaxKind, string>> = {
  DAS: "GUIA_DAS",
  DAS_MEI: "GUIA_DAS",
  IRPJ: "GUIA_DARF",
  CSLL: "GUIA_DARF",
  PIS: "GUIA_DARF",
  COFINS: "GUIA_DARF",
  ISS: "GUIA_ISS",
  ICMS: "GUIA_ICMS",
  INSS: "GUIA_INSS",
  FGTS: "GUIA_FGTS",
};

export type ConfirmAssessmentResult =
  | { ok: true; paymentEntryId: string | null }
  | { ok: false; reason: "not_found" | "already_confirmed"; message: string };

export async function confirmAssessment(params: {
  organizationId: string;
  assessmentId: string;
  actor: PaymentActor;
}): Promise<ConfirmAssessmentResult> {
  const assessment = await prisma.taxAssessment.findFirst({
    where: { id: params.assessmentId, organizationId: params.organizationId },
  });
  if (!assessment) return { ok: false, reason: "not_found", message: "Apuração não encontrada" };
  if (assessment.status !== "DRAFT") {
    return { ok: false, reason: "already_confirmed", message: "Esta apuração já foi confirmada" };
  }

  let paymentEntryId: string | null = null;
  if (assessment.amountCents > 0) {
    const categoryId = await ensureTaxCategory(params.organizationId);
    const competenceMonth = assessment.period.includes("-T")
      ? quarterMonths(assessment.period)[2]
      : assessment.period;
    const dueDate = (assessment.dueDate ?? new Date()).toISOString().slice(0, 10);
    const [entry] = await createPaymentEntryRecord({
      organizationId: params.organizationId,
      actor: params.actor,
      input: {
        type: "PAYABLE",
        description: `${TAX_LABELS[assessment.tax]} — competência ${assessment.period}`,
        amount: assessment.amountCents,
        dueDate,
        competenceDate: `${competenceMonth}-01`,
        categoryId,
        notes: `Guia gerada pela aba Contábil (apuração ${assessment.id}). Valor ${formatCentsBrl(assessment.amountCents)}.`,
      },
    });
    paymentEntryId = entry?.id ?? null;
  }

  await prisma.taxAssessment.update({
    where: { id: assessment.id },
    data: {
      status: "CONFIRMED",
      paymentEntryId,
      confirmedAt: new Date(),
      confirmedById: params.actor.id,
    },
  });

  const obligationKind = TAX_OBLIGATION_KIND[assessment.tax];
  if (obligationKind) {
    const obligationPeriod = assessment.period.includes("-T") ? quarterMonths(assessment.period)[2] : assessment.period;
    await prisma.fiscalObligation.updateMany({
      where: { organizationId: params.organizationId, kind: obligationKind, period: obligationPeriod },
      data: { assessmentId: assessment.id },
    });
  }

  return { ok: true, paymentEntryId };
}

async function ensureTaxCategory(organizationId: string): Promise<string> {
  const existing = await prisma.paymentCategory.findFirst({
    where: { organizationId, name: TAX_CATEGORY_NAME, type: "EXPENSE" },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.paymentCategory.create({
    data: { organizationId, name: TAX_CATEGORY_NAME, type: "EXPENSE", color: "#8B5CF6", icon: "landmark" },
    select: { id: true },
  });
  return created.id;
}
