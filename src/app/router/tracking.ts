import prisma from "@/lib/prisma";
import { os } from "@orpc/server";
import z from "zod";
import { base } from "../middlewares/base";
import { requiredAuthMiddleware } from "./auth";

export const listTrackings = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/trackings",
    summary: "List all trackings",
    tags: ["Trackings"],
  })
  .input(z.void())
  .handler(async ({ input, context }) => {
    const { auth } = context;

    console.log(auth);
    const trackings = await prisma.tracking.findMany();
    return trackings;
  });
