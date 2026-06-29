import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

export const healthRoute: FastifyPluginAsyncZod = async (app) => {
  app.route({
    method: "GET",
    url: "/health",
    schema: {
      response: {
        200: z.object({
          status: z.literal("ok"),
          uptime: z.number(),
        }),
      },
    },
    handler: async () => ({ status: "ok" as const, uptime: process.uptime() }),
  });
};
