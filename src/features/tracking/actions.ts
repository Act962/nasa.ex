"use server";

import { requireAuth } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import z from "zod";

const createTrackingSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

type CreateTrackingSchema = z.infer<typeof createTrackingSchema>;

export async function createTracking(data: CreateTrackingSchema) {
  try {
    const parseData = createTrackingSchema.parse(data);

    const session = await requireAuth();

    if (!session.session.activeOrganizationId) {
      return {
        error: "Organização não encontrada",
      };
    }

    await prisma.tracking.create({
      data: {
        name: parseData.name,
        description: parseData.description,
        participants: {
          create: {
            userId: session.user.id,
          },
        },
        organizationId: session.session.activeOrganizationId,
      },
    });

    revalidatePath("/tracking");
  } catch (error) {
    console.log(error);
    return {
      error: "Erro ao criar tracking",
    };
  }
}

const createStatusSchema = z.object({
  name: z.string(),
  color: z.string().optional(),
  trackingId: z.string(),
});

type CreateStatusSchema = z.infer<typeof createStatusSchema>;

export async function createStatus(data: CreateStatusSchema) {
  try {
    const parseData = createStatusSchema.parse(data);

    const session = await requireAuth();

    if (!session) {
      return {
        error: "Não autorizado",
      };
    }

    await prisma.status.create({
      data: {
        name: parseData.name,
        color: parseData.color,
        trackingId: parseData.trackingId,
      },
    });

    revalidatePath(`/tracking/${parseData.trackingId}`);
  } catch (error) {
    return {
      error: "Erro ao criar status",
    };
  }
}
