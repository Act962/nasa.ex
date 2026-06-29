export const getContrastColor = (hexColor: string): string => {
  // Remove o # se existir
  const hex = hexColor.replace("#", "");

  // Converte para RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calcula a luminância relativa (fórmula WCAG)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Retorna branco para cores escuras e preto para cores claras
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
};
