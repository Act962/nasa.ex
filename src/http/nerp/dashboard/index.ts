import { z } from "zod";
import { callNerpProcedure } from "../_call";
import type { NerpOrgConfig } from "../types";
import {
  getDashboardInputSchema,
  getDashboardOutputSchema,
} from "./schemas";

export type GetDashboardInput = z.infer<typeof getDashboardInputSchema>;

export async function getDashboard(cfg: NerpOrgConfig, input: GetDashboardInput) {
  const raw = await callNerpProcedure<unknown>(cfg, "dashboard.get", input ?? {});
  return getDashboardOutputSchema.parse(raw).dashboard;
}
