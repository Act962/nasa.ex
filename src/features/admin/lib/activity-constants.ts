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
  "nasa-planner":   "ÓRBITA Planner",
  "nasa-route":     "ÓRBITA Route",
  "nasa-partner":   "ÓRBITA Partner",
  partner:          "ÓRBITA Partner",
  "nasa-payment":   "ÓRBITA Payment",
  payment:          "ÓRBITA Payment",
  "nasa-space-help": "ÓRBITA Space Help",
  "space-help":     "ÓRBITA Space Help",
  spacehelp:        "ÓRBITA Space Help",
  insights:         "Insights",
  nbox:             "N-Box",
  linnker:          "Linnker",
  forms:            "Formulários",
  workspace:        "Workspace",
  spacehome:        "Spacehome",
  station:          "Space Station",
  "space-station":  "Space Station",
  permissions:      "Permissões",
  explorer:         "ÓRBITA Explorer",
  system:           "Sistema",
};

export const APP_SLUGS = Object.keys(APP_LABELS);
