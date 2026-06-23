import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { createInstance } from "@/http/uazapi/admin/create-instance";
import { configureWebhook } from "@/http/uazapi/configure-webhook";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { WhatsAppProvider } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import z from "zod";

export const createInstanceUazapi = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Create a new instance",
    tags: ["Integrations"],
  })
  .input(
    z.object({
      name: z.string(),
      // Provider escolhido pelo cliente ANTES de criar (1:1 por tracking).
      //  - UAZAPI: provisiona via Uazapi (cria instância + webhook).
      //  - META_CLOUD: cria só a row local; a conexão (credenciais/OAuth)
      //    é feita depois pelo card "Provider WhatsApp" (Embedded Signup
      //    ou form manual). Não fala com a Uazapi.
      provider: z
        .enum([WhatsAppProvider.UAZAPI, WhatsAppProvider.META_CLOUD])
        .default(WhatsAppProvider.UAZAPI),
      systemName: z.string().optional(),
      adminField01: z.string().optional(),
      adminField02: z.string().optional(),
      fingerprintProfile: z.string().optional(),
      browser: z.string().optional(),
      trackingId: z.string(),
    }),
  )

  .handler(async ({ input, context, errors }) => {
    const { name, systemName, provider, trackingId } = input;

    if (!context.session.activeOrganizationId) {
      throw new Error("Organization ID not found");
    }
    const organizationId = context.session.activeOrganizationId;

    // Guard 1:1 — um tracking só pode ter uma instância. O @unique no
    // schema já barra no banco, mas devolvemos um erro claro antes.
    const existing = await prisma.whatsAppInstance.findUnique({
      where: { trackingId },
      select: { id: true },
    });
    if (existing) {
      throw errors.BAD_REQUEST({
        message: "Este tracking já tem uma instância de WhatsApp.",
      });
    }

    try {
      // ── Caminho Meta Cloud API: cria só a row local ──────────────────
      // Sem credenciais ainda (Uazapi fields null) — o cliente conecta
      // depois via Embedded Signup / form manual, que preenchem
      // provider=META_CLOUD + credenciais cifradas.
      if (provider === WhatsAppProvider.META_CLOUD) {
        const instance = await prisma.whatsAppInstance.create({
          data: {
            trackingId,
            instanceName: name,
            profileName: systemName,
            provider: WhatsAppProvider.META_CLOUD,
            organizationId,
          },
        });

        await logActivity({
          organizationId,
          userId: context.user.id,
          userName: context.user.name,
          userEmail: context.user.email,
          userImage: (context.user as any).image,
          appSlug: "integrations",
          action: "integration.whatsapp.created",
          actionLabel: `Criou a integração WhatsApp Oficial "${name}"`,
          resource: name,
          resourceId: instance.id,
          metadata: { trackingId, provider: WhatsAppProvider.META_CLOUD },
        });

        return { instance };
      }

      // ── Caminho Uazapi (default): provisiona via Uazapi + webhook ─────
      const responseData = await createInstance({
        data: input,
        token: process.env.UAZAPI_TOKEN!,
        baseUrl: process.env.NEXT_PUBLIC_UAZAPI_BASE_URL,
      });

      if (!responseData.response) {
        throw new Error(responseData.response);
      }

      await configureWebhook({
        token: responseData.token,
        data: {
          url: `${process.env.NEXT_PUBLIC_APP_URL}/api/chat/webhook?trackingId=${trackingId}`,
          enabled: true,
          events: ["messages", "connection", "labels", "chat_labels"],
          action: "add",
          excludeMessages: ["wasSentByApi", "isGroupYes"],
        },
      });

      const instance = await prisma.whatsAppInstance.create({
        data: {
          trackingId,
          instanceName: name,
          profileName: systemName,
          apiKey: responseData.token,
          baseUrl: process.env.NEXT_PUBLIC_UAZAPI_BASE_URL!,
          instanceId: responseData.instance.id,
          createdAt: new Date(),
          organizationId,
        },
      });

      await logActivity({
        organizationId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "integrations",
        action: "integration.whatsapp.created",
        actionLabel: `Criou a integração WhatsApp "${name}"`,
        resource: name,
        resourceId: instance.id,
        metadata: { trackingId },
      });

      return { instance };
    } catch (error) {
      // Re-lança erros oRPC (ex.: BAD_REQUEST) sem mascarar.
      if (error instanceof Error && error.name === "ORPCError") throw error;
      console.error(error);
      throw new Error("Failed to create instance");
    }
  });
