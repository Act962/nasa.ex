// Recusa única do Astro (spec 0082, RF-5/RF-6): não diz o App, não diz se o
// dado existe e não cita pessoas. Vale em todos os canais.

export const ASTRO_READ_DENIAL =
  "Você não tem permissão para receber essa informação, consulte o administrador do Órbita.";

export const ASTRO_WRITE_DENIAL =
  "Você não tem permissão para fazer isso, consulte o administrador do Órbita.";

export function astroDenialFor(action: string): string {
  return action === "view" ? ASTRO_READ_DENIAL : ASTRO_WRITE_DENIAL;
}
