export function phoneMask(value: string | null) {
  if (!value) return "";

  value = value.replace(/\D/g, "");

  return value
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .replace(/(-\d{4})\d+?$/, "$1");
}

export const normalizePhone = (value = "") => value.replace(/\D/g, "");

export function phoneMaskFull(value: string | null) {
  if (!value) return "";

  const digits = value.replace(/\D/g, "").slice(0, 13);

  // Com código do país (+55 (85) 98888-8888)
  if (digits.length > 11) {
    return digits
      .replace(/^(\d{2})(\d{2})(\d)/, "+$1 ($2) $3")
      .replace(/(\d{4,5})(\d{4})$/, "$1-$2");
  }

  if (digits.length <= 10) {
    // Telefone fixo (85) 8888-8888
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  // Celular (85) 98888-8888
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}
