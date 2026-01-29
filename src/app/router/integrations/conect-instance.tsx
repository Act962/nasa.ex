import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { connectInstance } from "@/http/uazapi/connect-instance";
import z from "zod";

export const connectInstanceUazapi = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Create a new instance",
    tags: ["Integrations"],
  })
  .input(
    z.object({
      token: z.string(),
      phone: z.string().optional(),
      baseUrl: z.string().optional(),
    }),
  )

  .handler(async ({ input, context }) => {
    const { token, phone, baseUrl } = input;
    const result = await connectInstance(token, phone, baseUrl);
    return result;
  });
