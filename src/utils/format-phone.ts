export function phoneMask(value: string) {
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
