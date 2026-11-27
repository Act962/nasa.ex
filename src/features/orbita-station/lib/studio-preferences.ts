// Fundo e pose do estúdio: só aparência para quem está olhando, sem valor para o servidor. Fica no navegador; se o
// armazenamento falhar (aba anônima, bloqueio), o estúdio abre com o padrão.
import { z } from "zod";

export const STUDIO_BACKGROUNDS = [
  { key: "studio", label: "Estúdio", css: "radial-gradient(60% 55% at 50% 45%, #55545f, #17161d 72%)" },
  { key: "space", label: "Espaço", css: "radial-gradient(55% 50% at 50% 40%, #5a2aa8, #120a2e 72%)" },
  { key: "neon", label: "Neon", css: "radial-gradient(60% 55% at 50% 45%, #1fa0b5, #08202b 75%)" },
  { key: "pink", label: "Rosa", css: "radial-gradient(60% 55% at 50% 45%, #c43ad8, #2f0b3b 75%)" },
  { key: "light", label: "Claro", css: "radial-gradient(60% 55% at 50% 45%, #ffffff, #c4c8d6 78%)" },
  { key: "sunset", label: "Pôr do sol", css: "linear-gradient(180deg, #ffb36b, #e0389a 55%, #3a1660)" },
] as const;

export const STUDIO_POSES = [
  { clip: "Idle_A", label: "Parado" },
  { clip: "Idle_B", label: "Relaxado" },
  { clip: "Walking_A", label: "Andando" },
  { clip: "Running_A", label: "Correndo" },
  { clip: "Jump_Full_Short", label: "Pulando" },
  { clip: "Interact", label: "Interagindo" },
  { clip: "PickUp", label: "Pegando" },
  { clip: "Use_Item", label: "Usando item" },
  { clip: "Throw", label: "Arremessando" },
  { clip: "Hit_A", label: "Susto" },
  { clip: "Spawn_Ground", label: "Chegando" },
] as const;

const STORAGE_KEY = "orbita-station:studio-v1";
const preferencesSchema = z.object({
  background: z.enum(STUDIO_BACKGROUNDS.map((background) => background.key) as [string, ...string[]]),
  pose: z.enum(STUDIO_POSES.map((pose) => pose.clip) as [string, ...string[]]),
});
export type StudioPreferences = z.infer<typeof preferencesSchema>;

const DEFAULT_PREFERENCES: StudioPreferences = { background: "studio", pose: "Idle_A" };

export function readStudioPreferences(): StudioPreferences {
  try {
    const parsed = preferencesSchema.safeParse(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"));
    return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writeStudioPreferences(preferences: StudioPreferences) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Sem armazenamento: vale só nesta visita.
  }
}
