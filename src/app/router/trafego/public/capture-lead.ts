import { base } from "@/app/middlewares/base";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { clientIpFromHeaders, takeRateLimit } from "@/lib/rate-limit";
import { captureTrafegoLead } from "@/features/trafego/server/lib/capture-trafego-lead";
import { notifyAdminsOfCapturedLead } from "@/features/trafego/server/lib/notify-lead-captured";
import { publishLeadCreated } from "@/features/leads/realtime/publish";
import { recordLeadEvent } from "@/features/leads/lib/history";
import {
  TrafegoObjective,
  TrafegoPlatform,
} from "@/generated/prisma/enums";

/**
 * Lead do passo Contato do wizard (spec 0021). Roda sem auth e antes de
 * existir compra: é o que dá ao time um contato de quem abandona no pagamento.
 *
 * Só devolve se criou — o wizard não usa o retorno para nada além de telemetria.
 */
export const captureTrafegoLeadProcedure = base
  .route({ method: "POST", summary: "Registra lead do passo Contato do trafeGO" })
  .input(
    z.object({
      fullName: z.string().trim().min(2).max(120),
      email: z.string().trim().email().max(160),
      phone: z.string().trim().min(10).max(30),
      platform: z.nativeEnum(TrafegoPlatform).nullish(),
      objective: z.nativeEnum(TrafegoObjective).nullish(),
      businessName: z.string().trim().max(120).nullish(),
      segment: z.string().trim().max(120).nullish(),
      adBudgetBrlCents: z.number().int().nonnegative().max(100_000_000).nullish(),
      referralSource: z.string().trim().max(60).nullish(),
    }),
  )
  .output(z.object({ captured: z.boolean() }))
  .handler(async ({ input, context }) => {
    const ip = clientIpFromHeaders(context.headers);
    const limit = takeRateLimit("trafego-lead-capture", ip, {
      max: 10,
      windowMs: 10 * 60_000,
    });
    if (!limit.allowed) {
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: `Muitas tentativas. Tente de novo em ${limit.retryAfterSeconds}s.`,
      });
    }

    const capture = {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      platform: input.platform ?? null,
      objective: input.objective ?? null,
      businessName: input.businessName ?? null,
      segment: input.segment ?? null,
      adBudgetBrlCents: input.adBudgetBrlCents ?? null,
      referralSource: input.referralSource ?? null,
    };

    const result = await captureTrafegoLead(capture);
    if (!result) return { captured: false };

    // Só card novo vira popup: quem volta no wizard não é lead novo (D-7).
    if (result.created) {
      // Sem isto o card só aparece para quem recarrega o board: o Kanban se
      // atualiza por este evento, e a captura não passa pelo fluxo do form.
      await publishLeadCreated({
        leadId: result.leadId,
        trackingId: result.trackingId,
        statusId: result.statusId,
        source: "form",
      });

      // Jornada do lead: sem isto o card nasce com a timeline vazia e a
      // origem existe só na descrição. `form_submit` é o mesmo evento que o
      // formulário público grava — o passo Contato é um formulário.
      await recordLeadEvent({
        leadId: result.leadId,
        eventType: "FORM_SUBMITTED",
        metadata: {
          formName: "trafeGO — passo Contato",
          source: "trafego_wizard",
          ...(capture.platform ? { platform: capture.platform } : {}),
          ...(capture.objective ? { objective: capture.objective } : {}),
          ...(capture.adBudgetBrlCents
            ? { adBudgetBrlCents: capture.adBudgetBrlCents }
            : {}),
          ...(capture.referralSource
            ? { referralSource: capture.referralSource }
            : {}),
        },
      }).catch((error) =>
        console.warn("[trafego/capture] recordLeadEvent falhou:", error),
      );

      await notifyAdminsOfCapturedLead({
        leadId: result.leadId,
        trackingId: result.trackingId,
        capture,
      });
    }

    return { captured: result.created };
  });
