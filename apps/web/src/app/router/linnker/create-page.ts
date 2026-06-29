import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import prisma from "@/lib/prisma";
import z from "zod";

export const createLinnkerPage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/linnker/pages",
    summary: "Create a new Linnker page",
  })
  .input(
    z.object({
      title: z.string().min(1),
      slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
      bio: z.string().optional(),
      coverColor: z.string().optional(),
      buttonStyle: z.enum(["rounded", "sharp", "pill"]).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { title, slug, bio, coverColor, buttonStyle } = input;
    const organizationId = context.session.activeOrganizationId;

    if (!organizationId) throw errors.BAD_REQUEST({ message: "Organization not found" });

    const existing = await prisma.linnkerPage.findUnique({ where: { slug } });
    if (existing) throw errors.BAD_REQUEST({ message: "Este slug já está em uso" });

    const page = await prisma.linnkerPage.create({
      data: {
        organizationId,
        userId: context.user.id,
        title,
        slug,
        bio,
        coverColor: coverColor ?? "#6366f1",
        buttonStyle: buttonStyle ?? "rounded",
      },
    });

    await logActivity({
      organizationId,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "linnker",
      subAppSlug: "linnker-pages",
      featureKey: "linnker.page.created",
      action: "linnker_page_create",
      actionLabel: `Criou a página Linnker "${page.title}" (/${page.slug})`,
      resource: page.title,
      resourceId: page.id,
      metadata: { slug: page.slug },
    });

    await chargeStarsByAction(organizationId, "linnker_page_create", {
      userId: context.user.id,
      description: `Criou página Linnker "${page.title}"`,
      appSlug: "linnker",
    });

    return { message: "Página criada com sucesso", page };
  });
