export function phoneMask(value: string | null) {
  if (!value) return "";

  value = value.replace(/\D/g, "");

  if (value.length <= 10) {
    // Telefone fixo
    return value
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .replace(/(-\d{4})\d+?$/, "$1");
  }

  // Celular
  return value
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .replace(/(-\d{4})\d+?$/, "$1");
}

export const normalizePhone = (value = "") => value.replace(/\D/g, "");

export function phoneMaskFull(value: string | null) {
  if (!value) return "";

  value = value.replace(/\D/g, "");

  // Com código do país (+00 (00) 0000-0000)
  if (value.length >= 12) {
    return value
      .replace(/^(\d{2})(\d{2})(\d)/, "+$1 ($2) $3")
      .replace(/(\d{4,5})(\d{4})$/, "$1-$2");
  }

  if (value.length <= 10) {
    // Telefone fixo
    return value
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .replace(/(-\d{4})\d+?$/, "$1");
  }

  // Celular
  return value
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .replace(/(-\d{4})\d+?$/, "$1");
}
