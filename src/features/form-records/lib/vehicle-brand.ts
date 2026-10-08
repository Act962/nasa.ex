// Marca a partir do modelo do veículo ("Toyota Corolla" → "Toyota"), para o
// campo de nome-chave `marca` se preencher sozinho ao escolher o modelo.

export const VEHICLE_MODEL_FIELD_KEYS = ["modelo", "veiculo"];
export const VEHICLE_BRAND_FIELD_KEY = "marca";

const TWO_WORD_BRANDS = ["Land Rover", "Alfa Romeo", "Aston Martin", "Caoa Chery", "Rolls Royce", "Great Wall", "Mercedes Benz"];

export function detectVehicleBrand(model: string): string {
  const words = model.trim().split(/\s+/).filter(Boolean);
  // Uma palavra só é o modelo sem a marca: não dá para adivinhar.
  if (words.length < 2) return "";
  const firstTwoWords = `${words[0]} ${words[1]}`.replace(/-/g, " ").toLowerCase();
  const twoWordBrand = TWO_WORD_BRANDS.find((brand) => brand.toLowerCase() === firstTwoWords);
  if (twoWordBrand && words.length > 2) return `${words[0]} ${words[1]}`;
  return words[0];
}
