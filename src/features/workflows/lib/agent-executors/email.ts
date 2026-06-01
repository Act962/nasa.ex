/**
 * SEND_EMAIL — executor agent-mode pra envio de email transacional via
 * Resend + React Email templates.
 *
 * Hoje suporta 3 modos via `data.action.template`:
 *
 *   1. "welcome-course"    — boas-vindas NASA Route pós-pagamento
 *   2. "cart-abandoned"    — recuperação de carrinho (usado pelo cron, mas
 *                            também pode ser disparado manual)
 *   3. "custom"            — HTML cru com interpolação básica de {{vars}}
 *
 * O lead destinatário vem do `context.lead.email` por default; pode ser
 * sobrescrito com `data.action.toEmail`. Falha sem email = NÃO derruba o
 * workflow (output: skipped). Falha do Resend = FAILED (workflow para).
 *
 * Cobra Stars via `AGENT_STARS_ACTIONS.SEND_EMAIL` (precisa adicionar a
 * constante — feito mais abaixo).
 */
import "server-only";
import { resend } from "@/lib/email/resend";
import { reactWelcomeCourseEmail } from "@/lib/email/welcome-course";
import {
  reactCartAbandonedCourseEmail,
  type CartAbandonedStage,
} from "@/lib/email/cart-abandoned-course";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { AGENT_STARS_ACTIONS } from "../agent-stars-actions";
import { interpolate } from "../workflow-context";
import type { NodeExecutor } from "../run-workflow";

type EmailAction = {
  /** Template a usar. Default "custom". */
  template?: "welcome-course" | "cart-abandoned" | "custom";
  /** Destinatário (default: context.lead.email). */
  toEmail?: string;
  /** Assunto (interpolável). Pra welcome/cart, override do default do template. */
  subject?: string;
  /** Pra "custom" — HTML cru com {{vars}}. */
  html?: string;
  /** Variáveis pra interpolar no HTML/subject custom (além de lead/vars contexto). */
  variables?: Record<string, string>;
  /** Pra welcome-course/cart-abandoned: props específicas do template. */
  templateProps?: Record<string, unknown>;
};

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@nasaagents.com";

export const sendEmailExecutor: NodeExecutor = async ({
  data,
  context,
  dryRun,
}) => {
  const action =
    (data.action && typeof data.action === "object"
      ? (data.action as EmailAction)
      : (data as EmailAction)) ?? {};
  const template = action.template ?? "custom";

  // Destinatário — prioriza data.action.toEmail, cai pra context.lead.email
  const leadEmail =
    (context.lead as Record<string, unknown> | undefined)?.email ?? null;
  const toEmailRaw = action.toEmail ?? (leadEmail ? String(leadEmail) : "");
  const toEmail = toEmailRaw.includes("{{")
    ? interpolate(context, toEmailRaw)
    : toEmailRaw;

  if (!toEmail || !toEmail.includes("@")) {
    // Lead sem email não é erro fatal — só pula e segue (não trava workflow).
    return {
      output: {
        skipped: true,
        reason: "Lead sem email — SEND_EMAIL pulado",
      },
      chosenOutput: "main",
    };
  }

  // ── Assunto + props ─────────────────────────────────────────────
  const subjectRaw = String(
    action.subject ??
      (template === "welcome-course"
        ? "Bem-vindo(a)! Acesso ao curso liberado 🚀"
        : template === "cart-abandoned"
          ? "Sua matrícula NASA Route te aguarda"
          : "Mensagem da NASA Agents"),
  );
  const subject = interpolate(context, subjectRaw);

  const orgId = String(
    data.organizationId ?? context.trigger?.organizationId ?? "",
  );

  // ── Dry-run: preview sem enviar ─────────────────────────────────
  if (dryRun) {
    return {
      output: {
        dryRun: true,
        template,
        toEmail,
        subject,
        preview: `Email "${template}" pra ${toEmail}: ${subject}`,
      },
      chosenOutput: "main",
    };
  }

  // ── Render template + send ──────────────────────────────────────
  try {
    let reactElement: React.ReactElement;
    const props = (action.templateProps ?? {}) as Record<string, unknown>;
    const leadCtx = (context.lead ?? {}) as Record<string, unknown>;

    if (template === "welcome-course") {
      reactElement = reactWelcomeCourseEmail({
        studentName: String(
          props.studentName ?? leadCtx.name ?? "Aluno(a)",
        ),
        studentEmail: toEmail,
        courseTitle: String(props.courseTitle ?? "seu curso NASA Route"),
        planName: String(props.planName ?? "Acesso ao curso"),
        creatorName: String(props.creatorName ?? "NASA Agents"),
        coursePlayerUrl: String(props.coursePlayerUrl ?? ""),
        totalLessons:
          typeof props.totalLessons === "number"
            ? props.totalLessons
            : undefined,
        totalModules:
          typeof props.totalModules === "number"
            ? props.totalModules
            : undefined,
        supportEmail:
          typeof props.supportEmail === "string"
            ? props.supportEmail
            : undefined,
      });
    } else if (template === "cart-abandoned") {
      reactElement = reactCartAbandonedCourseEmail({
        studentName: String(
          props.studentName ?? leadCtx.name ?? "Aluno(a)",
        ),
        studentEmail: toEmail,
        courseTitle: String(props.courseTitle ?? "seu curso NASA Route"),
        planName: String(props.planName ?? "Acesso ao curso"),
        creatorName: String(props.creatorName ?? "NASA Agents"),
        amountBrl: Number(props.amountBrl ?? 0),
        checkoutUrl: String(props.checkoutUrl ?? ""),
        stage: (props.stage as CartAbandonedStage) ?? "d3",
        supportEmail:
          typeof props.supportEmail === "string"
            ? props.supportEmail
            : undefined,
      });
    } else {
      // Custom: HTML cru, interpola {{lead.X}} + {{vars.X}} + {{variables.X}}.
      const htmlRaw = String(action.html ?? "");
      if (!htmlRaw.trim()) {
        return {
          output: { error: "html vazio em template custom" },
          status: "FAILED",
          errorMessage: "send_email_html_missing",
        };
      }
      const interpolated = interpolate(context, htmlRaw);
      // Custom não tem React template — Resend aceita `html` direto.
      const sendResult = await resend.emails.send({
        from: FROM_EMAIL,
        to: toEmail,
        subject,
        html: interpolated,
      });
      if (sendResult.error) {
        return {
          output: { error: sendResult.error.message ?? "resend_failed" },
          status: "FAILED",
          errorMessage:
            sendResult.error.message ?? "Resend retornou erro no send",
        };
      }
      if (orgId) {
        await chargeStarsByAction(
          orgId,
          AGENT_STARS_ACTIONS.SEND_EMAIL,
          { description: "Email custom enviado pelo agente", appSlug: "agent" },
        ).catch((e) => console.warn("[send-email charge]", e));
      }
      return {
        output: {
          sent: true,
          template: "custom",
          toEmail,
          subject,
          messageId: sendResult.data?.id ?? null,
        },
        starsSpent: 1,
      };
    }

    // ── Template react: Resend renderiza React → HTML internamente ──
    const sendResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject,
      react: reactElement,
    });

    if (sendResult.error) {
      return {
        output: {
          error: sendResult.error.message ?? "resend_failed",
          template,
          toEmail,
        },
        status: "FAILED",
        errorMessage: sendResult.error.message ?? "Resend retornou erro",
      };
    }

    if (orgId) {
      await chargeStarsByAction(orgId, AGENT_STARS_ACTIONS.SEND_EMAIL, {
        description: `Email template="${template}" enviado pelo agente`,
        appSlug: "agent",
      }).catch((e) => console.warn("[send-email charge]", e));
    }

    return {
      output: {
        sent: true,
        template,
        toEmail,
        subject,
        messageId: sendResult.data?.id ?? null,
      },
      starsSpent: 1,
    };
  } catch (err) {
    return {
      output: {
        error: err instanceof Error ? err.message : "send_email_failed",
      },
      status: "FAILED",
      errorMessage: err instanceof Error ? err.message : "send_email_failed",
    };
  }
};
