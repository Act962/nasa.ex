import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { resend } from "@/lib/email/resend";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { sendText } from "@/http/uazapi/send-text";

// Nunca armazena a senha master no código — lê apenas do ambiente
function getMasterHash(): string {
  const h = process.env.PAYMENT_MASTER_HASH;
  if (!h) throw new Error("PAYMENT_MASTER_HASH not set");
  return h;
}

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const accessShape = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string(),
  isAuthorized: z.boolean(),
  phone: z.string().nullable(),
  authorizedById: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  user: z.object({ id: z.string(), name: z.string(), email: z.string() }),
});

// ── verify ────────────────────────────────────────────────────────────────────
// Verifica o PIN do usuário atual (hash individual ou hash master do env)

export const verifyPaymentPin = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Verify payment PIN", tags: ["Payment"] })
  .input(z.object({ pin: z.string().min(4).max(16) }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const access = await prisma.paymentAccess.findUnique({
        where: {
          userId_organizationId: {
            userId: context.user.id,
            organizationId: context.org.id,
          },
        },
      });

      // Tenta hash master primeiro (nunca expõe a senha em si)
      const masterMatch = await bcrypt.compare(input.pin, getMasterHash()).catch(() => false);
      if (masterMatch) return { ok: true };

      if (!access || !access.isAuthorized) return { ok: false };

      const match = await bcrypt.compare(input.pin, access.passwordHash);
      return { ok: match };
    } catch (err) {
      console.error("[payment/access/verify]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

// ── list ──────────────────────────────────────────────────────────────────────

export const listPaymentAccess = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "List payment access records", tags: ["Payment"] })
  .input(z.object({}))
  .output(z.object({ records: z.array(accessShape) }))
  .handler(async ({ context, errors }) => {
    try {
      const records = await prisma.paymentAccess.findMany({
        where: { organizationId: context.org.id },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      });
      return { records };
    } catch (err) {
      console.error("[payment/access/list]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

// ── grant (cria ou regenera PIN e envia ao usuário) ───────────────────────────

export const grantPaymentAccess = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Grant payment access and send PIN", tags: ["Payment"] })
  .input(z.object({
    userId: z.string(),
    phone: z.string().optional(),  // número WhatsApp (com DDI)
    sendVia: z.enum(["email", "whatsapp"]).default("email"),
  }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const pin = generatePin();
      const hash = await bcrypt.hash(pin, 12);

      const targetUser = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, name: true, email: true },
      });
      if (!targetUser) throw errors.NOT_FOUND;

      await prisma.paymentAccess.upsert({
        where: { userId_organizationId: { userId: input.userId, organizationId: context.org.id } },
        create: {
          userId: input.userId,
          organizationId: context.org.id,
          passwordHash: hash,
          isAuthorized: true,
          phone: input.phone ?? null,
          authorizedById: context.user.id,
        },
        update: {
          passwordHash: hash,
          isAuthorized: true,
          phone: input.phone ?? undefined,
          authorizedById: context.user.id,
        },
      });

      const message =
        `🔐 NASA Payment — Acesso liberado!\n\nOlá, ${targetUser.name}.\nSeu PIN de acesso ao módulo financeiro é:\n\n*${pin}*\n\nGuarde em local seguro. O PIN não é armazenado em texto puro.`;

      if (input.sendVia === "whatsapp") {
        const phone = input.phone ?? "";
        if (phone) {
          await sendText(
            process.env.UAZAPI_TOKEN!,
            { number: phone, text: message },
            process.env.NEXT_PUBLIC_UAZAPI_BASE_URL,
          );
        }
      } else {
        await resend.emails.send({
          from: process.env.BETTER_AUTH_EMAIL ?? "noreply@nasaex.com",
          to: targetUser.email,
          subject: "🔐 NASA Payment — Seu PIN de acesso",
          html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>NASA Payment — Acesso liberado</h2>
            <p>Olá, <strong>${targetUser.name}</strong>.</p>
            <p>Seu PIN de acesso ao módulo financeiro é:</p>
            <div style="font-size:2rem;letter-spacing:.5rem;font-weight:bold;color:#1E90FF;padding:1rem;background:#f0f7ff;border-radius:8px;text-align:center">${pin}</div>
            <p style="color:#888;font-size:.85rem;margin-top:1rem">Guarde em local seguro. O PIN não é armazenado em texto puro e não pode ser recuperado após este envio.</p>
          </div>`,
        });
      }

      return { ok: true };
    } catch (err) {
      if ((err as { code?: string }).code === "FORBIDDEN" || (err as { code?: string }).code === "NOT_FOUND") throw err;
      console.error("[payment/access/grant]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

// ── revoke ────────────────────────────────────────────────────────────────────

export const revokePaymentAccess = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "DELETE", summary: "Revoke payment access", tags: ["Payment"] })
  .input(z.object({ userId: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      await prisma.paymentAccess.updateMany({
        where: { userId: input.userId, organizationId: context.org.id },
        data: { isAuthorized: false },
      });
      return { ok: true };
    } catch (err) {
      console.error("[payment/access/revoke]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
