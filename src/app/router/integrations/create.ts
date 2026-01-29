import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { createInstance } from "@/http/uazapi/admin/create-instance";
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
      systemName: z.string().optional(),
      adminField01: z.string().optional(),
      adminField02: z.string().optional(),
      fingerprintProfile: z.string().optional(),
      browser: z.string().optional(),
      trackingId: z.string(),
    }),
  )

  .handler(async ({ input, context }) => {
    try {
      const responseData = await createInstance({
        data: input,
        token: process.env.UAZAPI_TOKEN!,
        baseUrl: process.env.NEXT_PUBLIC_UAZAPI_BASE_URL,
      });

      if (!responseData.response) {
        throw new Error(responseData.response);
      }

      if (!context.session.activeOrganizationId) {
        throw new Error("Organization ID not found");
      }

      const {
        name,
        systemName,
        adminField01,
        adminField02,
        fingerprintProfile,
        browser,
        trackingId,
      } = input;
      const instance = await prisma.whatsAppInstance.create({
        data: {
          trackingId: trackingId,
          instanceName: name,
          profileName: systemName,
          apiKey: responseData.token,
          baseUrl: process.env.NEXT_PUBLIC_UAZAPI_BASE_URL!,
          instanceId: responseData.instance.id,
          createdAt: new Date(),
          organizationId: context.session.activeOrganizationId,
        },
      });

      return { instance };
    } catch (error) {
      console.error(error);
      throw new Error("Failed to create instance");
    }
  });
