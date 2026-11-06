// Leitura do que a etapa 1 guardava no navegador. Na etapa 2 (spec 0119) tudo vai para o servidor: o avatar salvo
// aqui é enviado uma vez (RF-5) e as chaves são apagadas. Apagar este arquivo quando a etapa 2 estiver em produção há
// algumas semanas — quem não voltou até lá começa com o visual padrão.
import { avatarLookSchema, type AvatarLook } from "./avatar-look";

const STORAGE_PREFIX = "orbita-station:v1";

export function readLegacyAvatarLook(userId: string): AvatarLook | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:avatar:${userId}`);
    if (raw === null) return null;
    const parsed = avatarLookSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function clearLegacyPreferences(userId: string) {
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}:avatar:${userId}`);
    window.localStorage.removeItem(`${STORAGE_PREFIX}:template`);
  } catch {
    // Navegador sem armazenamento: não há nada para apagar.
  }
}
