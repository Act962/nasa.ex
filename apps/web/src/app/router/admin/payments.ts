import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import prisma from "@/lib/prisma";

const adminBase = base.use(requireAdminMiddleware);

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 6) + "••••••••••••" + key.slice(-4);
}

// ── List gateway configs ──────────────────────────────────────────────────────

export const listGatewayConfigs = adminBase
  .route({ method: "GET", summary: "List payment gateway configs" })
  .output(z.object({
    gateways: z.array(z.object({
      id:            z.string(),
      provider:      z.string(),
      label:         z.string().nullable(),
      secretKeyMask: z.string(),
      publicKey:     z.string().nullable(),
      hasWebhookSecret: z.boolean(),
      environment:   z.string(),
      isActive:      z.boolean(),
      isDefault:     z.boolean(),
      createdAt:     z.string(),
    })),
  }))
  .handler(async () => {
    const rows = await prisma.paymentGatewayConfig.findMany({
      orderBy: { createdAt: "asc" },
    });

    return {
      gateways: rows.map((r) => ({
        id:               r.id,
        provider:         r.provider,
        label:            r.label,
        secretKeyMask:    maskKey(r.secretKey),
        publicKey:        r.publicKey,
        hasWebhookSecret: !!r.webhookSecret,
        environment:      r.environment,
        isActive:         r.isActive,
        isDefault:        r.isDefault,
        createdAt:        r.createdAt.toISOString(),
      })),
    };
  });

// ── Set (upsert) gateway config ───────────────────────────────────────────────

export const setGatewayConfig = adminBase
  .route({ method: "POST", summary: "Create or update gateway config" })
  .input(z.object({
    id:            z.string().optional(), // omit = create
    provider:      z.enum(["stripe", "asaas"]),
    label:         z.string().optional(),
    secretKey:     z.string().min(4, "Chave obrigatória"),
    publicKey:     z.string().optional(),
    webhookSecret: z.string().optional(),
    environment:   z.enum(["production", "sandbox"]).default("production"),
    isActive:      z.boolean().default(true),
    isDefault:     z.boolean().default(false),
  }))
  .output(z.object({ id: z.string() }))
  .handler(async ({ input }) => {
    // If setting as default, unset all others first
    if (input.isDefault) {
      await prisma.paymentGatewayConfig.updateMany({
        data: { isDefault: false },
      });
    }

    if (input.id) {
      // Update - only update secretKey if it's not a masked placeholder
      const existing = await prisma.paymentGatewayConfig.findUniqueOrThrow({
        where: { id: input.id },
      });

      const updatedKey = input.secretKey.includes("•")
        ? existing.secretKey
        : input.secretKey;

      const row = await prisma.paymentGatewayConfig.update({
        where: { id: input.id },
        data: {
          provider:      input.provider,
          label:         input.label ?? null,
          secretKey:     updatedKey,
          publicKey:     input.publicKey ?? null,
          webhookSecret: input.webhookSecret
            ? (input.webhookSecret.includes("•") ? existing.webhookSecret : input.webhookSecret)
            : null,
          environment:   input.environment,
          isActive:      input.isActive,
          isDefault:     input.isDefault,
        },
      });
      return { id: row.id };
    }

    // Create
    const row = await prisma.paymentGatewayConfig.create({
      data: {
        provider:      input.provider,
        label:         input.label ?? null,
        secretKey:     input.secretKey,
        publicKey:     input.publicKey ?? null,
        webhookSecret: input.webhookSecret ?? null,
        environment:   input.environment,
        isActive:      input.isActive,
        isDefault:     input.isDefault,
      },
    });
    return { id: row.id };
  });

// ── Delete gateway config ─────────────────────────────────────────────────────

export const deleteGatewayConfig = adminBase
  .route({ method: "DELETE", summary: "Delete gateway config" })
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input }) => {
    await prisma.paymentGatewayConfig.delete({ where: { id: input.id } });
    return { success: true };
  });

// ── Toggle active ─────────────────────────────────────────────────────────────

export const toggleGatewayActive = adminBase
  .route({ method: "POST", summary: "Toggle gateway active state" })
  .input(z.object({ id: z.string(), isActive: z.boolean() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input }) => {
    await prisma.paymentGatewayConfig.update({
      where: { id: input.id },
      data:  { isActive: input.isActive },
    });
    return { success: true };
  });

// ── List Stars payments (for admin visibility) ────────────────────────────────

export const listStarsPayments = adminBase
  .route({ method: "GET", summary: "List Stars payment records" })
  .input(z.object({
    limit:  z.number().default(50),
    offset: z.number().default(0),
    status: z.string().optional(),
  }))
  .output(z.object({
    payments: z.array(z.object({
      id:             z.string(),
      userId:         z.string(),
      organizationId: z.string(),
      starsAmount:    z.number(),
      amountBrl:      z.number(),
      provider:       z.string(),
      status:         z.string(),
      externalId:     z.string().nullable(),
      createdAt:      z.string(),
    })),
    total: z.number(),
  }))
  .handler(async ({ input }) => {
    const where = input.status ? { status: input.status } : undefined;

    const [rows, total] = await Promise.all([
      prisma.starsPayment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take:    input.limit,
        skip:    input.offset,
      }),
      prisma.starsPayment.count({ where }),
    ]);

    return {
      payments: rows.map((r) => ({
        id:             r.id,
        userId:         r.userId,
        organizationId: r.organizationId,
        starsAmount:    r.starsAmount,
        amountBrl:      Number(r.amountBrl),
        provider:       r.provider,
        status:         r.status,
        externalId:     r.externalId,
        createdAt:      r.createdAt.toISOString(),
      })),
      total,
    };
  });
