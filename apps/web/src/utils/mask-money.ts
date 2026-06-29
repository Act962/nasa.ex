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
