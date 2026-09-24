import "server-only";

// Polaridade de verbo: o usuário já disse se é ligar ou desligar, e isso é
// regex, não classificação. Usado pelos verbos de liga/desliga.

export function inferPolarity(
  text: string,
  field: string,
  negative: RegExp,
  positive: RegExp,
): Record<string, unknown> {
  if (negative.test(text)) return { [field]: false };
  if (positive.test(text)) return { [field]: true };
  return {};
}
