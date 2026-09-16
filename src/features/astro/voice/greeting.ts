/**
 * Pega só o primeiro nome do usuário pra usar em saudações.
 * Fallback: "amigo" — neutro, evita "Opa undefined, como posso te ajudar?".
 */
export function extractFirstName(fullName?: string | null): string {
  if (!fullName) return "amigo";
  const firstName = fullName.trim().split(/\s+/)[0];
  return firstName || "amigo";
}

/**
 * Saudação contextual baseada na hora do dia (fuso local do browser).
 * Curta — não soa robótico em TTS. Varia pra não cansar o ouvido (3 templates
 * por turno).
 */
export function buildGreeting(firstName: string): string {
  const hour = new Date().getHours();
  const timeBucket =
    hour < 6 ? "noite" : hour < 12 ? "manhã" : hour < 18 ? "tarde" : "noite";

  const templates: Record<string, string[]> = {
    manhã: [
      `Bom dia ${firstName}, como posso te ajudar?`,
      `Opa ${firstName}, bom dia. O que você precisa?`,
      `Oi ${firstName}, no que posso te ajudar hoje?`,
    ],
    tarde: [
      `Boa tarde ${firstName}, como posso te ajudar?`,
      `E aí ${firstName}, o que precisa?`,
      `Opa ${firstName}, tô aqui. O que você quer fazer?`,
    ],
    noite: [
      `Boa noite ${firstName}, como posso te ajudar?`,
      `Oi ${firstName}, ainda na ativa? O que precisa?`,
      `${firstName}, tô aqui. Manda ver.`,
    ],
  };
  const pool = templates[timeBucket]!;
  return pool[Math.floor(Math.random() * pool.length)]!;
}
