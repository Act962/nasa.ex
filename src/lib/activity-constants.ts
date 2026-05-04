// Client-safe constants (no Prisma imports)

export const APP_LABELS: Record<string, string> = {
  auth:             "Autenticação",
  tracking:         "Tracking / CRM",
  chat:             "Chat",
  forge:            "Forge",
  spacetime:        "SpaceTime / Agenda",
  contacts:         "Contatos",
  settings:         "Configurações",
  integrations:     "Integrações",
  "nasa-planner":   "NASA Planner",
  "nasa-route":     "NASA Route",
  "nasa-partner":   "NASA Partner",
  partner:          "NASA Partner",
  "nasa-payment":   "NASA Payment",
  payment:          "NASA Payment",
  "nasa-space-help": "NASA Space Help",
  "space-help":     "NASA Space Help",
  spacehelp:        "NASA Space Help",
  insights:         "Insights",
  nbox:             "N-Box",
  linnker:          "Linnker",
  forms:            "Formulários",
  workspace:        "Workspace",
  spacehome:        "Spacehome",
  station:          "Space Station",
  "space-station":  "Space Station",
  permissions:      "Permissões",
  explorer:         "NASA Explorer",
  system:           "Sistema",
};

export const APP_SLUGS = Object.keys(APP_LABELS);
