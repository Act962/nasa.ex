import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { getPagesEdgeConfig } from "@/features/pages/server/custom-domain";

export const getEdgeConfig = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/pages/edge-config",
    summary: "Destinos de DNS (CNAME e A) que o cliente aponta para usar domínio próprio",
  })
  .handler(async () => getPagesEdgeConfig());
