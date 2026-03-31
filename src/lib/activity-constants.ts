// Client-safe constants (no Prisma imports)

export const APP_LABELS: Record<string, string> = {
  auth:          "Autenticação",
  tracking:      "Tracking / CRM",
  chat:          "Chat",
  forge:         "Forge",
  spacetime:     "SpaceTime / Agenda",
  contacts:      "Contatos",
  settings:      "Configurações",
  integrations:  "Integrações",
  "nasa-planner": "NASA Planner",
  insights:      "Insights",
  nbox:          "NBox",
  permissions:   "Permissões",
  explorer:      "NASA Explorer",
  system:        "Sistema",
};

export const APP_SLUGS = Object.keys(APP_LABELS);
