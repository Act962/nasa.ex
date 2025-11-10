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

export default async function createTracking(data: CreateTrackingSchema) {
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

    revalidatePath("/");
  } catch (error) {
    console.log(error);
    return {
      error: "Erro ao criar tracking",
    };
  }
}
