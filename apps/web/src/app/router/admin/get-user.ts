import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getUser = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin — Get user detail", tags: ["Admin"] })
  .input(z.object({ userId: z.string() }))
  .output(z.object({
    id:            z.string(),
    name:          z.string(),
    email:         z.string(),
    image:         z.string().nullable(),
    nickname:      z.string().nullable(),
    isSystemAdmin: z.boolean(),
    emailVerified: z.boolean(),
    createdAt:     z.string(),
    members:       z.array(z.object({
      id:             z.string(),
      role:           z.string(),
      cargo:          z.string().nullable(),
      organizationId: z.string(),
      orgName:        z.string(),
    })),
  }))
  .handler(async ({ input, errors }) => {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true, name: true, email: true, image: true,
        nickname: true, isSystemAdmin: true, emailVerified: true, createdAt: true,
        members: {
          select: {
            id: true, role: true, cargo: true, organizationId: true,
            organization: { select: { name: true } },
          },
        },
      },
    });
    if (!user) throw errors.NOT_FOUND;

    return {
      id:            user.id,
      name:          user.name,
      email:         user.email,
      image:         user.image ?? null,
      nickname:      user.nickname ?? null,
      isSystemAdmin: user.isSystemAdmin,
      emailVerified: user.emailVerified,
      createdAt:     user.createdAt.toISOString(),
      members:       user.members.map((m) => ({
        id:             m.id,
        role:           m.role,
        cargo:          m.cargo ?? null,
        organizationId: m.organizationId,
        orgName:        m.organization.name,
      })),
    };
  });
