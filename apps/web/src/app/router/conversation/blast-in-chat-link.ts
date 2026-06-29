import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { resend } from "@/lib/email/resend";
import { logActivity } from "@/features/admin/lib/activity-logger";

/**
 * Disparo em massa do link In-Chat pros leads do tracking. Útil quando o
 * WhatsApp da org foi banido e a empresa precisa avisar todo mundo de
 * uma vez ("nossa linha mudou — continue por aqui").
 *
 * Envia email pra todos os leads que têm email cadastrado. Telefone
 * (SMS) fica pra sprint futura — exige integração extra (Twilio SMS,
 * verbose, custo por mensagem).
 *
 * Cobra **0★** por enquanto — operação de emergência, não cobramos a
 * org penalizando ela já que ela está enfrentando ban. Pode revisar
 * depois se virar abuso.
 *
 * Idempotente parcial: não bloqueia disparos repetidos (org pode mandar
 * de novo se a primeira leva falhou em parte). Mas anota em `logActivity`
 * pra auditoria.
 */

export const blastInChatLink = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/conversation/blast-in-chat-link",
    summary: "Dispara o link público do In-Chat pros leads via email",
    tags: ["Conversation", "In-Chat"],
  })
  .input(
    z.object({
      trackingId: z.string().min(1),
      /**
       * Origin do app (`window.location.origin`) — necessário pra montar
       * a URL absoluta `https://orbita.../whatsapp/<slug>` no email.
       * Fallback pra `BETTER_AUTH_URL` se não vier.
       */
      appOrigin: z.string().url().optional(),
    }),
  )
  .output(
    z.object({
      queued: z.number().int(),
      skipped: z.number().int(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const tracking = await prisma.tracking.findUnique({
      where: { id: input.trackingId },
      select: {
        id: true,
        name: true,
        organizationId: true,
        organization: { select: { slug: true, name: true } },
      },
    });
    if (!tracking || tracking.organizationId !== context.org.id) {
      throw errors.NOT_FOUND({ message: "Tracking não encontrado" });
    }

    const leads = await prisma.lead.findMany({
      where: {
        trackingId: input.trackingId,
        email: { not: null },
        statusFlow: { not: "FINISHED" },
        // `isArchived` é da PR #70 (ainda não mergeada nessa branch).
        // Quando aquela mergear, adicionar `isArchived: false` aqui pra
        // não disparar pra leads arquivados.
      },
      select: { id: true, name: true, email: true },
    });

    const origin =
      input.appOrigin ??
      process.env.BETTER_AUTH_URL ??
      "https://orbita.nasaex.com";
    const inChatUrl = `${origin.replace(/\/$/, "")}/whatsapp/${tracking.organization.slug}`;

    const fromAddress =
      process.env.RESEND_FROM_EMAIL ?? "no-reply@orbita.nasaex.com";

    let queued = 0;
    let skipped = 0;
    for (const lead of leads) {
      if (!lead.email) {
        skipped++;
        continue;
      }
      try {
        await resend.emails.send({
          from: fromAddress,
          to: lead.email,
          subject: `${tracking.organization.name} — Nova forma de continuar nossa conversa`,
          html: `
            <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; color: #0f172a;">
              <h1 style="font-size: 18px; margin: 0 0 12px;">Olá, ${lead.name}!</h1>
              <p style="font-size: 14px; line-height: 1.5;">
                Tivemos uma instabilidade temporária no nosso WhatsApp.
                Pra você continuar nossa conversa sem perder nada, criamos
                uma página exclusiva onde você acessa seu histórico e
                envia mensagens normalmente.
              </p>
              <p style="margin: 24px 0;">
                <a href="${inChatUrl}"
                   style="background:#10b981;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
                  Acessar conversa
                </a>
              </p>
              <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
                Use o mesmo número de telefone do WhatsApp pra entrar.
                Se preferir, copie o link: <br/>
                <a href="${inChatUrl}" style="color:#10b981;word-break:break-all;">${inChatUrl}</a>
              </p>
            </div>
          `,
        });
        queued++;
      } catch (err) {
        console.warn("[blastInChatLink] resend send failed", lead.id, err);
        skipped++;
      }
    }

    logActivity({
      organizationId: tracking.organizationId,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image ?? null,
      appSlug: "chat",
      subAppSlug: "in-chat",
      featureKey: "in_chat.blast_link",
      action: "in_chat.blast_link",
      actionLabel: `Disparou link do In-Chat pra ${queued} leads`,
      resource: "tracking",
      resourceId: tracking.id,
      metadata: { trackingName: tracking.name, queued, skipped },
    }).catch(() => {});

    return { queued, skipped };
  });
