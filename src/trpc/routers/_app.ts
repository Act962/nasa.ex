import { z } from "zod";
import { baseProcedure, createTRPCRouter, orgProcedure } from "../init";
import { statusRoutes } from "./status";
export const appRouter = createTRPCRouter({
  status: statusRoutes,
});
// export type definition of API
export type AppRouter = typeof appRouter;
