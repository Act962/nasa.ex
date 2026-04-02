import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteItem = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ itemId: z.string() }))
  .handler(async ({ input, context }) => {
    const item = await prisma.nBoxItem.findUnique({
      where: { id: input.itemId, organizationId: context.org.id },
      select: {
        id: true,
        url: true,
      },
    });

    if (!item) {
      throw new Error("Item não encontrado");
    }

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/s3/delete`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: item.url,
      }),
    });

    await prisma.nBoxItem.delete({
      where: { id: input.itemId, organizationId: context.org.id },
    });
    return { ok: true };
  });
