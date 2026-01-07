import { createTRPCRouter } from "@/trpc/init";
import { listStatus } from "./list";

export const statusRoutes = createTRPCRouter({
  list: listStatus,
});
