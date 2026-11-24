const UNITS = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

/** 0–999 por extenso ("quatrocentos e cinquenta"). */
export function hundredsToWords(value: number): string {
  if (value === 0) return "";
  if (value === 100) return "cem";
  const parts: string[] = [];
  if (value >= 100) parts.push(HUNDREDS[Math.floor(value / 100)]);
  const rest = value % 100;
  if (rest >= 20) {
    parts.push(TENS[Math.floor(rest / 10)]);
    if (rest % 10) parts.push(UNITS[rest % 10]);
  } else if (rest > 0) {
    parts.push(UNITS[rest]);
  }
  return parts.join(" e ");
}

/** Grupos de milhar unidos como no cheque: "e" quando o grupo seguinte é < 100 ou centena redonda. */
function integerToWords(value: number): string {
  if (value === 0) return "zero";
  const millions = Math.floor(value / 1_000_000);
  const thousands = Math.floor((value % 1_000_000) / 1000);
  const rest = value % 1000;
  const groups: { text: string; value: number }[] = [];
  if (millions) groups.push({ text: millions === 1 ? "um milhão" : `${hundredsToWords(millions)} milhões`, value: millions });
  if (thousands) groups.push({ text: thousands === 1 ? "mil" : `${hundredsToWords(thousands)} mil`, value: thousands });
  if (rest) groups.push({ text: hundredsToWords(rest), value: rest });
  return groups
    .map((group, index) => {
      if (index === 0) return group.text;
      const joinsWithAnd = group.value < 100 || group.value % 100 === 0;
      return `${joinsWithAnd ? " e " : " "}${group.text}`;
    })
    .join("");
}

/** 4500 → "quatro mil e quinhentos reais"; 1250.5 → "mil duzentos e cinquenta reais e cinquenta centavos". */
export function reaisPorExtenso(amount: number): string {
  const totalCents = Math.round(amount * 100);
  const reais = Math.floor(totalCents / 100);
  const cents = totalCents % 100;
  const isRoundMillion = reais >= 1_000_000 && reais % 1_000_000 === 0;
  const reaisText = reais ? `${integerToWords(reais)}${isRoundMillion ? " de" : ""} ${reais === 1 ? "real" : "reais"}` : "";
  const centsText = cents ? `${hundredsToWords(cents)} ${cents === 1 ? "centavo" : "centavos"}` : "";
  if (reaisText && centsText) return `${reaisText} e ${centsText}`;
  return reaisText || centsText || "zero real";
}
