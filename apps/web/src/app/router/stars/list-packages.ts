import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listStarPackages = base
  .use(requiredAuthMiddleware)
  .output(
    z.object({
      packages: z.array(
        z.object({
          id: z.string(),
          stars: z.number(),
          priceBrl: z.number(),
          label: z.string(),
        })
      ),
    })
  )
  .handler(async () => {
    const packages = await prisma.starPackage.findMany({
      where: { isActive: true },
      orderBy: { stars: "asc" },
      select: { id: true, stars: true, priceBrl: true, label: true },
    });

    return {
      packages: packages.map((p) => ({
        ...p,
        priceBrl: Number(p.priceBrl),
      })),
    };
  });
