import { createTRPCRouter } from "../init";
import { trackingRouter } from "./tracking";
export const appRouter = createTRPCRouter({
  trackings: trackingRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;
