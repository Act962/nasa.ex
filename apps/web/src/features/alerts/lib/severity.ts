/**
 * Camada de severidade pro sistema de alertas.
 *
 * 3 níveis com superfícies visuais diferentes:
 *   - info     → cai no NotificationBell (passivo)
 *   - warning  → toast persistente Sonner + bell + som leve
 *   - critical → popup full-screen interruptivo + bell + som forte
 *
 * `displaySurface` pode ser override por regra (ex: dev quer um info como popup
 * em casos extraordinários). Default deriva da severity.
 */

export const SEVERITIES = ["info", "warning", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const DISPLAY_SURFACES = ["bell", "toast", "popup"] as const;
export type DisplaySurface = (typeof DISPLAY_SURFACES)[number];

export function isSeverity(v: unknown): v is Severity {
  return typeof v === "string" && (SEVERITIES as readonly string[]).includes(v);
}

export function isDisplaySurface(v: unknown): v is DisplaySurface {
  return (
    typeof v === "string" &&
    (DISPLAY_SURFACES as readonly string[]).includes(v)
  );
}

/** Default surface por severity. Pode ser overridden por AlertRule.displaySurface. */
export function resolveDisplaySurface(severity: Severity): DisplaySurface {
  if (severity === "critical") return "popup";
  if (severity === "warning") return "toast";
  return "bell";
}

/** critical requer confirmação explícita (não só "read"). */
export function requiresAckBySeverity(severity: Severity): boolean {
  return severity === "critical";
}

/** Mapa de cores Tailwind por severity (badges, bordas, bg). */
export const SEVERITY_STYLE: Record<
  Severity,
  { badge: string; border: string; ring: string; label: string }
> = {
  info: {
    badge: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    border: "border-blue-500/30",
    ring: "ring-blue-500/40",
    label: "Informativo",
  },
  warning: {
    badge: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    border: "border-amber-500/40",
    ring: "ring-amber-500/50",
    label: "Atenção",
  },
  critical: {
    badge: "bg-red-500/10 text-red-600 border-red-500/30",
    border: "border-red-500/60",
    ring: "ring-red-500/60",
    label: "Crítico",
  },
};
