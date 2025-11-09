import { z } from "zod";
import { baseProcedure, createTRPCRouter } from "../init";
import { trackingRoutes } from "@/features/tracking/server/routes";

export const appRouter = createTRPCRouter({
  trackings: trackingRoutes,
});
// export type definition of API
export type AppRouter = typeof appRouter;
