import type { ReactElement } from "react";
import { inngest } from "@/inngest/client";
import { convertJsonToHtml } from "@/lib/json-to-html";
import { reactPurchaseDefaultEmail } from "@/lib/email/purchase-default";
import { reactPurchaseCustomEmail } from "@/lib/email/purchase-custom";

export const PURCHASE_EMAIL_VARIABLES = [
  { key: "studentName", label: "Nome do aluno" },
  { key: "courseTitle", label: "Título do curso" },
  { key: "creatorName", label: "Nome do criador" },
  { key: "orgName", label: "Nome da empresa" },
  { key: "planName", label: "Plano comprado" },
  { key: "amountBrl", label: "Valor pago (R$)" },
  { key: "accessUrl", label: "Link de acesso ao curso" },
  { key: "certificateUrl", label: "Link do certificado" },
] as const;

export type PurchaseEmailVariableKey =
  (typeof PURCHASE_EMAIL_VARIABLES)[number]["key"];

export interface PurchaseEmailContext {
  studentName: string;
  courseTitle: string;
  creatorName: string;
  orgName: string;
  planName: string | null;
  amountBrl: number | null;
  accessUrl: string;
  certificateUrl: string | null;
}

export interface CourseEmailConfig {
  purchaseEmailEnabled: boolean;
  purchaseEmailSubject: string | null;
  purchaseEmailBodyJson: unknown | null;
}

export interface RenderedPurchaseEmail {
  subject: string;
  react: ReactElement;
}

function formatVariable(
  key: PurchaseEmailVariableKey,
  ctx: PurchaseEmailContext,
): string {
  switch (key) {
    case "studentName":
      return ctx.studentName;
    case "courseTitle":
      return ctx.courseTitle;
    case "creatorName":
      return ctx.creatorName;
    case "orgName":
      return ctx.orgName;
    case "planName":
      return ctx.planName ?? "";
    case "amountBrl":
      return ctx.amountBrl != null
        ? ctx.amountBrl.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })
        : "";
    case "accessUrl":
      return ctx.accessUrl;
    case "certificateUrl":
      return ctx.certificateUrl ?? "";
  }
}

function applyPlaceholders(input: string, ctx: PurchaseEmailContext): string {
  return input.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (match, rawKey: string) => {
    const key = rawKey as PurchaseEmailVariableKey;
    const known = PURCHASE_EMAIL_VARIABLES.some((v) => v.key === key);
    if (!known) return match;
    return formatVariable(key, ctx);
  });
}

function defaultSubject(ctx: PurchaseEmailContext): string {
  return `Bem-vindo(a) ao curso ${ctx.courseTitle}`;
}

export function renderPurchaseEmail(
  course: CourseEmailConfig,
  ctx: PurchaseEmailContext,
): RenderedPurchaseEmail {
  const useCustom =
    course.purchaseEmailEnabled && course.purchaseEmailBodyJson != null;

  if (useCustom) {
    const rawHtml = convertJsonToHtml(
      course.purchaseEmailBodyJson as Parameters<typeof convertJsonToHtml>[0],
    );
    const bodyHtml = applyPlaceholders(rawHtml, ctx);
    const subjectTemplate =
      course.purchaseEmailSubject?.trim() || defaultSubject(ctx);
    const subject = applyPlaceholders(subjectTemplate, ctx);

    return {
      subject,
      react: reactPurchaseCustomEmail({
        previewText: subject,
        bodyHtml,
        orgName: ctx.orgName,
      }),
    };
  }

  return {
    subject: defaultSubject(ctx),
    react: reactPurchaseDefaultEmail({
      studentName: ctx.studentName,
      courseTitle: ctx.courseTitle,
      creatorName: ctx.creatorName,
      orgName: ctx.orgName,
      planName: ctx.planName,
      amountBrl: ctx.amountBrl,
      accessUrl: ctx.accessUrl,
    }),
  };
}

/**
 * Dispara (fire-and-forget) o envio do e-mail de pós-compra para o aluno.
 * Chamado em todos os 3 fluxos de matrícula: Stripe autenticado, resgate
 * público pós-signup e matrícula gratuita (isFree / free-access).
 *
 * Falhas no envio NUNCA devem reverter a matrícula — por isso usamos Inngest
 * (assíncrono + retries automáticos).
 */
export async function triggerPurchaseEmail(enrollmentId: string) {
  try {
    await inngest.send({
      name: "nasa-route/purchase.completed",
      data: { enrollmentId },
    });
  } catch (err) {
    console.error("[triggerPurchaseEmail] failed to enqueue", {
      enrollmentId,
      err,
    });
  }
}
