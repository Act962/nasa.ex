import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { resend } from "@/lib/email/resend";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { sendText } from "@/http/uazapi/send-text";
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import {
  PAYMENT_RESOURCES,
  PAYMENT_ACTIONS,
  ROLE_DEFAULTS,
  resolveEffectivePermissions,
} from "@/features/payment/lib/permissions";
import { logActivity } from "@/features/admin/lib/activity-logger";
import {
  ensureOrgOwnerPaymentAccess,
  claimOrgOwnerPaymentAccess,
  isOrgOwner,
} from "@/features/payment/server/ensure-payment-access";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getRpIdAndOrigin(): { rpID: string; origin: string } {
  const url =
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "http://localhost:3000";
  try {
    const parsed = new URL(url);
    return { rpID: parsed.hostname, origin: parsed.origin };
  } catch (err) {
    console.error("[payment/access/access]", err);
    return { rpID: "localhost", origin: "http://localhost:3000" };
  }
}

// WebAuthn challenges são curtos e descartáveis; mantidos em memória por
// (userId+orgId) com TTL de 5min. Suficiente pra single-instance dev/MVP; em
// múltiplas instâncias migrar pra Redis ou tabela com expires_at.
const webauthnChallenges = new Map<
  string,
  { challenge: string; expiresAt: number }
>();

function challengeKey(userId: string, organizationId: string) {
  return `${userId}::${organizationId}`;
}

function setChallenge(userId: string, orgId: string, challenge: string) {
  webauthnChallenges.set(challengeKey(userId, orgId), {
    challenge,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
}

function popChallenge(userId: string, orgId: string): string | null {
  const key = challengeKey(userId, orgId);
  const value = webauthnChallenges.get(key);
  webauthnChallenges.delete(key);
  if (!value || value.expiresAt < Date.now()) return null;
  return value.challenge;
}

async function fetchUserPhone(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true },
  });
  return user?.phone ?? null;
}

/** Identidade legível do alvo, para o rótulo do log de atividade (RF-8). */
async function describeTargetUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  return {
    id: userId,
    name: user?.name ?? userId,
    email: user?.email ?? userId,
  };
}

async function getOrgConfig(orgId: string) {
  const config = await prisma.paymentGovernanceConfig.findUnique({
    where: { organizationId: orgId },
  });
  return {
    sessionTimeoutMinutes: config?.sessionTimeoutMinutes ?? 30,
    otpEveryNSessions: config?.otpEveryNSessions ?? 10,
  };
}

async function sendWhatsappOtp(phone: string, name: string, code: string) {
  const token = process.env.UAZAPI_TOKEN;
  if (!token) throw new Error("UAZAPI_TOKEN not set");
  const text =
    `🔐 *NASA Payment*\n\n` +
    `Olá, ${name}.\n` +
    `Seu código de verificação é:\n\n*${code}*\n\n` +
    `Expira em 5 minutos. Nunca compartilhe este código.`;
  await sendText(
    token,
    { number: phone, text },
    process.env.NEXT_PUBLIC_UAZAPI_BASE_URL,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

const permissionResource = z.enum(PAYMENT_RESOURCES);
const permissionAction = z.enum(PAYMENT_ACTIONS);

const permissionsOverrideSchema = z
  .record(permissionResource, z.record(permissionAction, z.boolean()))
  .nullable();

const accessShape = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string(),
  isAuthorized: z.boolean(),
  phone: z.string().nullable(),
  role: z.enum(["VIEWER", "EDITOR", "ADMIN", "OWNER"]),
  permissions: z.unknown().nullable(),
  sessionCount: z.number(),
  hasWebauthn: z.boolean(),
  // Owner da empresa é autoprovisionado (spec 0007), então revogá-lo não
  // persiste — a UI usa esta flag pra avisar quem estiver revogando.
  isOrgOwner: z.boolean(),
  authorizedById: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable().optional(),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════
// DESATIVADAS pela spec 0007 (specs/payment/0007-acesso-financeiro-por-whitelist.md)
//
// As quatro procedures abaixo — verifyPaymentPin, verifyPaymentOtp,
// requestPaymentOtp e setupOwnerPaymentAccess — foram DESREGISTRADAS do router
// em `index.ts` e não são mais alcançáveis pela API. O acesso ao módulo passou
// a ser determinado só pela whitelist (isAuthorized + role).
//
// O código permanece aqui de propósito: reverter é reeditar o registro do
// router, e a fase de biometria vai reaproveitar a infraestrutura de
// credenciais. Não ligue nada disso de volta sem uma spec nova.
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// verifyPaymentPin — primeira etapa: senha permanente
// Retorna { ok, requiresOtp, unlocked, sessionTimeoutMinutes }
// Quando sessionCount % otpEveryNSessions === 0 (depois de incrementar),
// dispara OTP via WhatsApp e exige verifyPaymentOtp pra liberar.
// ─────────────────────────────────────────────────────────────────────────────

export const verifyPaymentPin = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Verify payment PIN", tags: ["Payment"] })
  .input(z.object({ pin: z.string().min(4).max(32) }))
  .output(
    z.object({
      ok: z.boolean(),
      requiresOtp: z.boolean(),
      sessionTimeoutMinutes: z.number(),
    }),
  )
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

      const config = await getOrgConfig(context.org.id);

      // passwordHash é opcional desde a spec 0007: acessos criados depois dela
      // não têm PIN, então não há o que comparar.
      if (!access || !access.isAuthorized || !access.passwordHash) {
        return {
          ok: false,
          requiresOtp: false,
          sessionTimeoutMinutes: config.sessionTimeoutMinutes,
        };
      }

      const match = await bcrypt.compare(input.pin, access.passwordHash);
      if (!match) {
        return {
          ok: false,
          requiresOtp: false,
          sessionTimeoutMinutes: config.sessionTimeoutMinutes,
        };
      }

      const nextCount = access.sessionCount + 1;
      const needsOtp =
        config.otpEveryNSessions > 0 &&
        nextCount % config.otpEveryNSessions === 0;

      if (!needsOtp) {
        await prisma.paymentAccess.update({
          where: { id: access.id },
          data: { sessionCount: nextCount },
        });
        return {
          ok: true,
          requiresOtp: false,
          sessionTimeoutMinutes: config.sessionTimeoutMinutes,
        };
      }

      // Gera OTP de 6 dígitos e envia via WhatsApp. Senha está OK, mas só
      // libera depois do OTP — daí ok=false + requiresOtp=true.
      const otp = generatePin();
      const otpHash = await bcrypt.hash(otp, 10);
      const phone = access.phone ?? (await fetchUserPhone(access.userId));

      await prisma.paymentAccess.update({
        where: { id: access.id },
        data: {
          // sessionCount só incrementa depois do OTP validado — mantém aqui
          pendingOtpHash: otpHash,
          pendingOtpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      if (phone) {
        const targetUser = await prisma.user.findUnique({
          where: { id: access.userId },
          select: { name: true },
        });
        await sendWhatsappOtp(phone, targetUser?.name ?? "usuário", otp);
      }

      return {
        ok: false,
        requiresOtp: true,
        sessionTimeoutMinutes: config.sessionTimeoutMinutes,
      };
    } catch (err) {
      console.error("[payment/access/verify]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// verifyPaymentOtp — segunda etapa: código WhatsApp
// ─────────────────────────────────────────────────────────────────────────────

export const verifyPaymentOtp = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Verify payment OTP", tags: ["Payment"] })
  .input(z.object({ otp: z.string().min(4).max(8) }))
  .output(z.object({ ok: z.boolean(), sessionTimeoutMinutes: z.number() }))
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
      const config = await getOrgConfig(context.org.id);

      if (
        !access ||
        !access.pendingOtpHash ||
        !access.pendingOtpExpiresAt ||
        access.pendingOtpExpiresAt < new Date()
      ) {
        return {
          ok: false,
          sessionTimeoutMinutes: config.sessionTimeoutMinutes,
        };
      }

      const match = await bcrypt.compare(input.otp, access.pendingOtpHash);
      if (!match) {
        return {
          ok: false,
          sessionTimeoutMinutes: config.sessionTimeoutMinutes,
        };
      }

      await prisma.paymentAccess.update({
        where: { id: access.id },
        data: {
          sessionCount: access.sessionCount + 1,
          lastOtpAt: new Date(),
          pendingOtpHash: null,
          pendingOtpExpiresAt: null,
        },
      });

      return { ok: true, sessionTimeoutMinutes: config.sessionTimeoutMinutes };
    } catch (err) {
      console.error("[payment/access/verifyOtp]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// requestPaymentOtp — re-envia OTP (rate-limited 1/min)
// ─────────────────────────────────────────────────────────────────────────────

export const requestPaymentOtp = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Resend payment OTP", tags: ["Payment"] })
  .input(z.object({}))
  .output(z.object({ ok: z.boolean(), cooldownSeconds: z.number().optional() }))
  .handler(async ({ context, errors }) => {
    try {
      const access = await prisma.paymentAccess.findUnique({
        where: {
          userId_organizationId: {
            userId: context.user.id,
            organizationId: context.org.id,
          },
        },
      });
      if (!access || !access.isAuthorized) throw errors.FORBIDDEN;

      // Rate-limit: 1 reenvio por minuto
      if (
        access.pendingOtpExpiresAt &&
        access.pendingOtpExpiresAt.getTime() - Date.now() > 4 * 60 * 1000
      ) {
        const cooldownSeconds = Math.ceil(
          (access.pendingOtpExpiresAt.getTime() - Date.now() - 4 * 60 * 1000) /
            1000,
        );
        return { ok: false, cooldownSeconds };
      }

      const otp = generatePin();
      const otpHash = await bcrypt.hash(otp, 10);
      const phone = access.phone ?? (await fetchUserPhone(access.userId));
      if (!phone) {
        throw errors.BAD_REQUEST({
          message: "Sem telefone cadastrado em Geral > Telefone",
        });
      }

      await prisma.paymentAccess.update({
        where: { id: access.id },
        data: {
          pendingOtpHash: otpHash,
          pendingOtpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      const targetUser = await prisma.user.findUnique({
        where: { id: access.userId },
        select: { name: true },
      });
      await sendWhatsappOtp(phone, targetUser?.name ?? "usuário", otp);

      return { ok: true };
    } catch (err) {
      if (
        (err as { code?: string }).code === "FORBIDDEN" ||
        (err as { code?: string }).code === "BAD_REQUEST"
      )
        throw err;
      console.error("[payment/access/requestOtp]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// getMyPaymentAccess — usuário lê própria role/permissions/has-webauthn
// ─────────────────────────────────────────────────────────────────────────────

export const getMyPaymentAccess = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Get my payment access", tags: ["Payment"] })
  .input(z.object({}))
  .output(
    z.object({
      authorized: z.boolean(),
      role: z.enum(["VIEWER", "EDITOR", "ADMIN", "OWNER"]).nullable(),
      effective: z.unknown().nullable(),
      // Sinaliza pro frontend "estamos em bootstrap" — a org ainda não tem
      // NINGUÉM autorizado. Combinado com master-da-org, libera a aba de
      // Acesso Financeiro em Permissões antes de existir um OWNER.
      orgHasAnyAccess: z.boolean(),
      // True quando o caller não tem acesso MAS é owner da empresa — caso das
      // contas de staff, barradas na autoprovisão por RF-13. O gate usa isso
      // pra oferecer o botão de auto-liberação em vez de uma tela sem saída.
      canClaimAsOrgOwner: z.boolean(),
    }),
  )
  .handler(async ({ context, errors }) => {
    try {
      // Ponto de entrada do módulo: é aqui que o owner da empresa é
      // autoprovisionado (spec 0007), pra ninguém cair na tela de bloqueio à toa.
      const access = await ensureOrgOwnerPaymentAccess(
        context.user,
        context.org.id,
      );
      const anyAccess = await prisma.paymentAccess.findFirst({
        where: { organizationId: context.org.id, isAuthorized: true },
        select: { id: true },
      });
      const orgHasAnyAccess = !!anyAccess;

      if (!access || !access.isAuthorized) {
        return {
          authorized: false,
          role: null,
          effective: null,
          orgHasAnyAccess,
          canClaimAsOrgOwner: await isOrgOwner(context.user.id, context.org.id),
        };
      }

      return {
        authorized: true,
        role: access.role,
        effective: resolveEffectivePermissions(access.role, access.permissions),
        orgHasAnyAccess,
        canClaimAsOrgOwner: false,
      };
    } catch (err) {
      console.error("[payment/access/getMy]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// list / grant / revoke / updateRole / updatePermissions
// ─────────────────────────────────────────────────────────────────────────────

async function requireOwnerAccess(userId: string, orgId: string) {
  const my = await prisma.paymentAccess.findUnique({
    where: { userId_organizationId: { userId, organizationId: orgId } },
  });
  return my?.isAuthorized && my.role === "OWNER";
}

async function requireOwnerOrAdminAccess(userId: string, orgId: string) {
  const my = await prisma.paymentAccess.findUnique({
    where: { userId_organizationId: { userId, organizationId: orgId } },
  });
  return my?.isAuthorized && (my.role === "OWNER" || my.role === "ADMIN");
}

/**
 * Retorna true se o caller pode listar/reivindicar acesso no cenário de
 * bootstrap — quando a org ainda NÃO tem nenhum PaymentAccess autorizado E
 * o caller é master (owner) da organização. Depois que existir OWNER de
 * verdade, essa porta fecha automaticamente.
 */
async function isMasterInBootstrap(userId: string, orgId: string) {
  const anyAccess = await prisma.paymentAccess.findFirst({
    where: { organizationId: orgId, isAuthorized: true },
    select: { id: true },
  });
  if (anyAccess) return false;
  return isOrgOwner(userId, orgId);
}

// claimOwnerPaymentAccess — owner da empresa libera o próprio acesso (RF-14).
// Existe para quem é owner mas foi barrado na autoprovisão por ser staff da
// plataforma (RF-13): uma organização por clique, registrado no log como ação
// deliberada, nunca em lote.
export const claimOwnerPaymentAccess = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Org owner claims own payment access",
    tags: ["Payment"],
  })
  .input(z.object({}))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ context, errors }) => {
    try {
      const access = await claimOrgOwnerPaymentAccess(
        context.user,
        context.org.id,
      );
      if (!access) {
        throw errors.FORBIDDEN({
          message: "Só o owner da empresa pode liberar o próprio acesso",
        });
      }
      return { ok: true };
    } catch (err) {
      if ((err as { code?: string }).code === "FORBIDDEN") throw err;
      console.error("[payment/access/claimOwner]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const listPaymentAccess = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "List payment access records",
    tags: ["Payment"],
  })
  .input(z.object({}))
  .output(z.object({ records: z.array(accessShape) }))
  .handler(async ({ context, errors }) => {
    try {
      const allowed =
        (await requireOwnerOrAdminAccess(context.user.id, context.org.id)) ||
        (await isMasterInBootstrap(context.user.id, context.org.id));
      if (!allowed) throw errors.FORBIDDEN;

      const records = await prisma.paymentAccess.findMany({
        where: { organizationId: context.org.id },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      const orgOwners = await prisma.member.findMany({
        where: { organizationId: context.org.id, role: "owner" },
        select: { userId: true },
      });
      const orgOwnerIds = new Set(orgOwners.map((member) => member.userId));
      return {
        records: records.map((record) => ({
          id: record.id,
          userId: record.userId,
          organizationId: record.organizationId,
          isAuthorized: record.isAuthorized,
          phone: record.phone,
          role: record.role,
          permissions: record.permissions,
          sessionCount: record.sessionCount,
          hasWebauthn: Array.isArray(record.webauthnCredentials)
            ? record.webauthnCredentials.length > 0
            : false,
          isOrgOwner: orgOwnerIds.has(record.userId),
          authorizedById: record.authorizedById,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          user: record.user,
        })),
      };
    } catch (err) {
      if ((err as { code?: string }).code === "FORBIDDEN") throw err;
      console.error("[payment/access/list]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const grantPaymentAccess = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Grant payment access",
    tags: ["Payment"],
  })
  .input(
    z.object({
      userId: z.string(),
      phone: z.string().optional(),
      role: z.enum(["VIEWER", "EDITOR", "ADMIN", "OWNER"]).default("VIEWER"),
      sendVia: z.enum(["email", "whatsapp"]).default("whatsapp"),
    }),
  )
  .output(
    z.object({
      ok: z.boolean(),
      // Aviso de entrega é best-effort: a concessão já está gravada quando o
      // envio falha, então canal indisponível nunca invalida o acesso (RF-7).
      deliveryWarning: z.string().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const isOwner = await requireOwnerAccess(context.user.id, context.org.id);
      if (!isOwner) {
        // primeiro acesso: se ainda não existe NENHUM PaymentAccess pra org,
        // o caller vira o primeiro OWNER (bootstrap pra não trancar a org)
        const anyAccess = await prisma.paymentAccess.findFirst({
          where: { organizationId: context.org.id, isAuthorized: true },
        });
        if (anyAccess) throw errors.FORBIDDEN;
      }

      // Aceita ID OU email — se não bate por ID, tenta por email
      let targetUser = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, name: true, email: true, phone: true },
      });
      if (!targetUser && input.userId.includes("@")) {
        targetUser = await prisma.user.findUnique({
          where: { email: input.userId.toLowerCase() },
          select: { id: true, name: true, email: true, phone: true },
        });
      }
      if (!targetUser) {
        throw errors.NOT_FOUND({
          message: "Usuário não encontrado por ID nem por e-mail",
        });
      }

      const phone = input.phone ?? targetUser.phone ?? null;

      await prisma.paymentAccess.upsert({
        where: {
          userId_organizationId: {
            userId: targetUser.id,
            organizationId: context.org.id,
          },
        },
        create: {
          userId: targetUser.id,
          organizationId: context.org.id,
          isAuthorized: true,
          phone,
          role: input.role,
          authorizedById: context.user.id,
        },
        update: {
          isAuthorized: true,
          phone: phone ?? undefined,
          role: input.role,
          authorizedById: context.user.id,
        },
      });

      const message =
        `🔐 *NASA Payment* — Acesso liberado\n\n` +
        `Olá, ${targetUser.name}.\n` +
        `Você recebeu acesso ao módulo financeiro da sua organização.\n` +
        `Basta entrar na plataforma e abrir o NASA Payment — não há senha ` +
        `separada.\n\n` +
        `Nível de acesso: ${input.role}.`;

      // Entrega é best-effort e nunca carrega segredo. A concessão já está
      // gravada; canal indisponível vira aviso, não falha (RF-7).
      let deliveredVia: "whatsapp" | "email" | "none" = "none";
      let deliveryWarning: string | undefined;

      async function tryWhatsapp() {
        const token = process.env.UAZAPI_TOKEN;
        if (!token) throw new Error("UAZAPI_TOKEN não configurado");
        if (!phone) throw new Error("Sem telefone (Geral > Telefone)");
        await sendText(
          token,
          { number: phone, text: message },
          process.env.NEXT_PUBLIC_UAZAPI_BASE_URL,
        );
      }

      async function tryEmail() {
        await resend.emails.send({
          from: process.env.BETTER_AUTH_EMAIL ?? "noreply@nasaex.com",
          to: targetUser!.email,
          subject: "🔐 NASA Payment — Acesso liberado",
          html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>NASA Payment — Acesso liberado</h2>
            <p>Olá, <strong>${targetUser!.name}</strong>.</p>
            <p>Você recebeu acesso ao módulo financeiro da sua organização.</p>
            <p>Basta entrar na plataforma e abrir o <strong>NASA Payment</strong> — não há senha separada.</p>
            <p>Nível de acesso: <strong>${input.role}</strong></p>
          </div>`,
        });
      }

      if (input.sendVia === "whatsapp") {
        try {
          await tryWhatsapp();
          deliveredVia = "whatsapp";
        } catch (err) {
          const reason = (err as Error).message;
          try {
            await tryEmail();
            deliveredVia = "email";
            deliveryWarning = `WhatsApp falhou (${reason}); enviado por e-mail.`;
          } catch (err2) {
            deliveryWarning = `Acesso liberado, mas o aviso não foi entregue (WhatsApp: ${reason}; e-mail: ${(err2 as Error).message}). Avise a pessoa manualmente.`;
          }
        }
      } else {
        try {
          await tryEmail();
          deliveredVia = "email";
        } catch (err) {
          deliveryWarning = `Acesso liberado, mas o aviso por e-mail falhou (${(err as Error).message}). Avise a pessoa manualmente.`;
        }
      }

      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as { image?: string | null }).image,
        appSlug: "payment",
        subAppSlug: "payment-access",
        featureKey: "payment.access.granted",
        action: "payment.access.granted",
        actionLabel: `Liberou acesso financeiro para ${targetUser.name} (${targetUser.email}) como ${input.role}`,
        resource: targetUser.email,
        resourceId: targetUser.id,
        metadata: { role: input.role, deliveredVia },
      });

      return { ok: true, deliveryWarning };
    } catch (err) {
      if (
        (err as { code?: string }).code === "FORBIDDEN" ||
        (err as { code?: string }).code === "NOT_FOUND"
      )
        throw err;
      console.error("[payment/access/grant]", err);
      throw errors.INTERNAL_SERVER_ERROR({
        message: (err as Error).message ?? "Falha ao liberar acesso",
      });
    }
  });

// Auto-cadastro do owner da empresa. Diferente de grantPaymentAccess (um OWNER
// libera outra pessoa), aqui o próprio owner da org define seu PIN e vira OWNER
// do módulo — sem depender de ninguém autorizá-lo. É o caminho que destrava o
// "primeiro usuário não consegue acessar o financeiro".
export const setupOwnerPaymentAccess = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Owner self-provisions payment access",
    tags: ["Payment"],
  })
  .input(
    z.object({
      pin: z.string().min(4).max(32),
      phone: z.string().optional(),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const isOwner = await isOrgOwner(context.user.id, context.org.id);
      if (!isOwner) throw errors.FORBIDDEN;

      const existing = await prisma.paymentAccess.findUnique({
        where: {
          userId_organizationId: {
            userId: context.user.id,
            organizationId: context.org.id,
          },
        },
      });
      // Já autorizado: este fluxo é só pra criar o acesso inicial, não pra
      // resetar PIN de quem já tem acesso.
      if (existing?.isAuthorized) throw errors.FORBIDDEN;

      const user = await prisma.user.findUnique({
        where: { id: context.user.id },
        select: { phone: true },
      });
      const phone = input.phone ?? user?.phone ?? null;
      const hash = await bcrypt.hash(input.pin, 12);

      await prisma.paymentAccess.upsert({
        where: {
          userId_organizationId: {
            userId: context.user.id,
            organizationId: context.org.id,
          },
        },
        create: {
          userId: context.user.id,
          organizationId: context.org.id,
          passwordHash: hash,
          isAuthorized: true,
          phone,
          role: "OWNER",
          authorizedById: context.user.id,
        },
        update: {
          passwordHash: hash,
          isAuthorized: true,
          phone: phone ?? undefined,
          role: "OWNER",
          authorizedById: context.user.id,
        },
      });

      return { ok: true };
    } catch (err) {
      if ((err as { code?: string }).code === "FORBIDDEN") throw err;
      console.error("[payment/access/setupOwner]", err);
      throw errors.INTERNAL_SERVER_ERROR({
        message: (err as Error).message ?? "Falha ao configurar acesso",
      });
    }
  });

export const revokePaymentAccess = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "DELETE",
    summary: "Revoke payment access",
    tags: ["Payment"],
  })
  .input(z.object({ userId: z.string() }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const isOwner = await requireOwnerAccess(context.user.id, context.org.id);
      if (!isOwner) throw errors.FORBIDDEN;
      await prisma.paymentAccess.updateMany({
        where: { userId: input.userId, organizationId: context.org.id },
        data: { isAuthorized: false },
      });

      const target = await describeTargetUser(input.userId);
      const targetIsOrgOwner = await isOrgOwner(input.userId, context.org.id);
      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as { image?: string | null }).image,
        appSlug: "payment",
        subAppSlug: "payment-access",
        featureKey: "payment.access.revoked",
        action: "payment.access.revoked",
        actionLabel: targetIsOrgOwner
          ? `Revogou acesso financeiro de ${target.name} (${target.email}) — owner da empresa, será reativado no próximo acesso`
          : `Revogou acesso financeiro de ${target.name} (${target.email})`,
        resource: target.email,
        resourceId: target.id,
        metadata: { targetIsOrgOwner },
      });

      return { ok: true };
    } catch (err) {
      if ((err as { code?: string }).code === "FORBIDDEN") throw err;
      console.error("[payment/access/revoke]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const updatePaymentRole = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Update payment role", tags: ["Payment"] })
  .input(
    z.object({
      userId: z.string(),
      role: z.enum(["VIEWER", "EDITOR", "ADMIN", "OWNER"]),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const isOwner = await requireOwnerAccess(context.user.id, context.org.id);
      if (!isOwner) throw errors.FORBIDDEN;
      await prisma.paymentAccess.updateMany({
        where: { userId: input.userId, organizationId: context.org.id },
        data: { role: input.role },
      });

      const target = await describeTargetUser(input.userId);
      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as { image?: string | null }).image,
        appSlug: "payment",
        subAppSlug: "payment-access",
        featureKey: "payment.access.role_changed",
        action: "payment.access.role_changed",
        actionLabel: `Alterou o nível de acesso financeiro de ${target.name} (${target.email}) para ${input.role}`,
        resource: target.email,
        resourceId: target.id,
        metadata: { role: input.role },
      });

      return { ok: true };
    } catch (err) {
      if ((err as { code?: string }).code === "FORBIDDEN") throw err;
      console.error("[payment/access/updateRole]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const updatePaymentPermissions = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Update payment permissions override",
    tags: ["Payment"],
  })
  .input(
    z.object({
      userId: z.string(),
      permissions: permissionsOverrideSchema,
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    try {
      const isOwner = await requireOwnerAccess(context.user.id, context.org.id);
      if (!isOwner) throw errors.FORBIDDEN;
      await prisma.paymentAccess.updateMany({
        where: { userId: input.userId, organizationId: context.org.id },
        data: { permissions: input.permissions ?? undefined },
      });

      const target = await describeTargetUser(input.userId);
      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as { image?: string | null }).image,
        appSlug: "payment",
        subAppSlug: "payment-access",
        featureKey: "payment.access.permissions_changed",
        action: "payment.access.permissions_changed",
        actionLabel: `Ajustou permissões financeiras de ${target.name} (${target.email})`,
        resource: target.email,
        resourceId: target.id,
        metadata: { permissions: input.permissions ?? null },
      });

      return { ok: true };
    } catch (err) {
      if ((err as { code?: string }).code === "FORBIDDEN") throw err;
      console.error("[payment/access/updatePermissions]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// WebAuthn (Face ID / Touch ID / passkeys)
// ─────────────────────────────────────────────────────────────────────────────

type StoredCredential = {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  label?: string;
  createdAt: string;
};

function parseCredentials(value: unknown): StoredCredential[] {
  if (!Array.isArray(value)) return [];
  return value as StoredCredential[];
}

export const startWebauthnRegistration = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Start WebAuthn registration",
    tags: ["Payment"],
  })
  .input(z.object({}))
  .output(z.object({ options: z.unknown() }))
  .handler(async ({ context, errors }) => {
    try {
      const access = await prisma.paymentAccess.findUnique({
        where: {
          userId_organizationId: {
            userId: context.user.id,
            organizationId: context.org.id,
          },
        },
      });
      if (!access || !access.isAuthorized) throw errors.FORBIDDEN;

      const { rpID } = getRpIdAndOrigin();
      const existing = parseCredentials(access.webauthnCredentials);
      const options = await generateRegistrationOptions({
        rpName: "NASA Payment",
        rpID,
        userID: new TextEncoder().encode(access.userId),
        userName: context.user.email ?? context.user.name ?? access.userId,
        attestationType: "none",
        excludeCredentials: existing.map((credential) => ({
          id: credential.credentialId,
          transports: credential.transports as AuthenticatorTransportFuture[],
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
          authenticatorAttachment: "platform",
        },
      });
      setChallenge(context.user.id, context.org.id, options.challenge);
      return { options };
    } catch (err) {
      if ((err as { code?: string }).code === "FORBIDDEN") throw err;
      console.error("[payment/access/startWebauthnReg]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const finishWebauthnRegistration = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Finish WebAuthn registration",
    tags: ["Payment"],
  })
  .input(z.object({ response: z.unknown(), label: z.string().optional() }))
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
      if (!access || !access.isAuthorized) throw errors.FORBIDDEN;

      const challenge = popChallenge(context.user.id, context.org.id);
      if (!challenge)
        throw errors.BAD_REQUEST({ message: "Challenge expirado" });

      const { rpID, origin } = getRpIdAndOrigin();
      const verification = await verifyRegistrationResponse({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response: input.response as any,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
      if (!verification.verified || !verification.registrationInfo) {
        return { ok: false };
      }

      const credential = verification.registrationInfo.credential;
      const stored: StoredCredential = {
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64"),
        counter: credential.counter,
        transports: credential.transports,
        label: input.label ?? "Face ID / Touch ID",
        createdAt: new Date().toISOString(),
      };

      const existing = parseCredentials(access.webauthnCredentials);
      await prisma.paymentAccess.update({
        where: { id: access.id },
        data: {
          webauthnCredentials: [...existing, stored] as unknown as object,
        },
      });
      return { ok: true };
    } catch (err) {
      if (
        (err as { code?: string }).code === "FORBIDDEN" ||
        (err as { code?: string }).code === "BAD_REQUEST"
      )
        throw err;
      console.error("[payment/access/finishWebauthnReg]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const startWebauthnAuth = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Start WebAuthn auth", tags: ["Payment"] })
  .input(z.object({}))
  .output(z.object({ options: z.unknown() }))
  .handler(async ({ context, errors }) => {
    try {
      const access = await prisma.paymentAccess.findUnique({
        where: {
          userId_organizationId: {
            userId: context.user.id,
            organizationId: context.org.id,
          },
        },
      });
      if (!access || !access.isAuthorized) throw errors.FORBIDDEN;

      const { rpID } = getRpIdAndOrigin();
      const existing = parseCredentials(access.webauthnCredentials);
      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: "preferred",
        allowCredentials: existing.map((credential) => ({
          id: credential.credentialId,
          transports: credential.transports as AuthenticatorTransportFuture[],
        })),
      });
      setChallenge(context.user.id, context.org.id, options.challenge);
      return { options };
    } catch (err) {
      if ((err as { code?: string }).code === "FORBIDDEN") throw err;
      console.error("[payment/access/startWebauthnAuth]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

export const finishWebauthnAuth = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Finish WebAuthn auth", tags: ["Payment"] })
  .input(z.object({ response: z.unknown() }))
  .output(z.object({ ok: z.boolean(), sessionTimeoutMinutes: z.number() }))
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
      const config = await getOrgConfig(context.org.id);
      if (!access || !access.isAuthorized) throw errors.FORBIDDEN;

      const challenge = popChallenge(context.user.id, context.org.id);
      if (!challenge) {
        throw errors.BAD_REQUEST({ message: "Challenge expirado" });
      }

      const credentials = parseCredentials(access.webauthnCredentials);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const responseAny = input.response as any;
      const credential = credentials.find(
        (c) => c.credentialId === responseAny?.id,
      );
      if (!credential) {
        return {
          ok: false,
          sessionTimeoutMinutes: config.sessionTimeoutMinutes,
        };
      }

      const { rpID, origin } = getRpIdAndOrigin();
      const verification = await verifyAuthenticationResponse({
        response: responseAny,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: credential.credentialId,
          publicKey: Buffer.from(credential.publicKey, "base64"),
          counter: credential.counter,
          transports: credential.transports as AuthenticatorTransportFuture[],
        },
      });
      if (!verification.verified) {
        return {
          ok: false,
          sessionTimeoutMinutes: config.sessionTimeoutMinutes,
        };
      }

      // Atualiza counter + sessão
      credential.counter = verification.authenticationInfo.newCounter;
      const nextCount = access.sessionCount + 1;
      await prisma.paymentAccess.update({
        where: { id: access.id },
        data: {
          sessionCount: nextCount,
          webauthnCredentials: credentials as unknown as object,
        },
      });
      return { ok: true, sessionTimeoutMinutes: config.sessionTimeoutMinutes };
    } catch (err) {
      if (
        (err as { code?: string }).code === "FORBIDDEN" ||
        (err as { code?: string }).code === "BAD_REQUEST"
      )
        throw err;
      console.error("[payment/access/finishWebauthnAuth]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });

// Helper type imported from SimpleWebAuthn (re-export to avoid namespace clash)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthenticatorTransportFuture = any;

// Re-exports usados pelo router que ainda importa o nome antigo
export { ROLE_DEFAULTS };
