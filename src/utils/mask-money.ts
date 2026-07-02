export const maskMoney = (value: string | number): string => {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "R$ 0,00";

  const amount = Number(digits) / 100;

  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const unmaskMoney = (value: string): number => {
  const digits = value.replace(/\D/g, "");
  return Number(digits);
};

// Formata um valor decimal vindo do backend (ex.: "1500", "1500.5") como moeda
// BRL para exibição no input. Diferente de `maskMoney`, interpreta o valor como
// reais (não como centavos acumulados).
export const formatDecimalToMoney = (
  value: string | number | null | undefined,
): string => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "R$ 0,00";

  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Converte a string mascarada de moeda ("R$ 1.500,00") para o decimal que o
// backend/Prisma espera ("1500.00").
export const moneyToDecimalString = (masked: string): string => {
  const cents = unmaskMoney(masked);
  return (cents / 100).toFixed(2);
};
