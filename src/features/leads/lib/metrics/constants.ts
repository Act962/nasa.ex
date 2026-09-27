// Contrato do recálculo automático das métricas do lead (spec 0035, D-4).

export const LEAD_METRICS_RECOMPUTE_EVENT = "lead/metrics.recompute";

/** Leads criados a partir daqui já nascem com métricas; os anteriores esperam o "Auditar Lead". */
export const AUTO_METRICS_SINCE = new Date("2026-09-26T00:00:00-03:00");
