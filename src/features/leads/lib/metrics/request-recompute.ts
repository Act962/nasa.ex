import "server-only";
import { inngest } from "@/inngest/client";
import { LEAD_METRICS_RECOMPUTE_EVENT } from "./constants";

/** Pede o recálculo das métricas do lead. Best-effort: nunca derruba quem chamou. */
export async function requestLeadMetricsRecompute(leadId: string): Promise<void> {
  try {
    await inngest.send({ name: LEAD_METRICS_RECOMPUTE_EVENT, data: { leadId } });
  } catch (error) {
    console.error("[lead-metrics] falha ao pedir recálculo", error);
  }
}
