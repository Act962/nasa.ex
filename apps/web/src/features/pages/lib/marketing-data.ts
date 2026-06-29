/**
 * Dados estáticos pro elemento Marketing — nomes BR (separados por
 * gênero) + cidades+UF pré-curados pra gerar toasts de social proof
 * realistas sem precisar de API externa.
 *
 * Permite que o user **adicione/edite** seus próprios nomes no
 * properties-panel; quando a lista do user está vazia, cai pros
 * defaults daqui. Quando `malePercent` < 100, sorteia entre as listas
 * masculina e feminina respeitando a proporção desejada.
 */

export interface MarketingPerson {
  name: string;
  city: string;
  state: string;
}

/** Nomes BR comuns masculinos. */
export const DEFAULT_BR_NAMES_MALE: string[] = [
  "Vinicius Vegas",
  "João Santos",
  "Pedro Souza",
  "Lucas Almeida",
  "Carlos Ferreira",
  "Rafael Gomes",
  "Bruno Ribeiro",
  "Gustavo Araújo",
  "Felipe Castro",
  "Marcos Lopes",
  "Eduardo Reis",
  "Tiago Moreira",
  "Roberto Mendes",
  "Henrique Vasconcelos",
  "Diego Tavares",
  "Daniel Pereira",
  "Mateus Oliveira",
  "André Costa",
  "Fernando Silva",
  "Thiago Martins",
];

/** Nomes BR comuns femininos. */
export const DEFAULT_BR_NAMES_FEMALE: string[] = [
  "Maria Silva",
  "Ana Costa",
  "Carla Pereira",
  "Mariana Rodrigues",
  "Beatriz Lima",
  "Juliana Carvalho",
  "Fernanda Martins",
  "Camila Barbosa",
  "Patrícia Dias",
  "Daniela Pinto",
  "Larissa Nunes",
  "Vanessa Cardoso",
  "Sofia Albuquerque",
  "Letícia Andrade",
  "Amanda Correia",
  "Carolina Ferreira",
  "Isabela Souza",
  "Renata Lima",
  "Priscila Oliveira",
  "Bianca Almeida",
];

/** Compat: lista combinada (usada por integrações que ainda esperam
 *  a forma antiga sem distinção de gênero). */
export const DEFAULT_BR_NAMES: string[] = [
  ...DEFAULT_BR_NAMES_MALE,
  ...DEFAULT_BR_NAMES_FEMALE,
];

export const DEFAULT_BR_CITIES: Array<{ city: string; state: string }> = [
  { city: "São Paulo", state: "SP" },
  { city: "Rio de Janeiro", state: "RJ" },
  { city: "Belo Horizonte", state: "MG" },
  { city: "Salvador", state: "BA" },
  { city: "Brasília", state: "DF" },
  { city: "Fortaleza", state: "CE" },
  { city: "Recife", state: "PE" },
  { city: "Porto Alegre", state: "RS" },
  { city: "Manaus", state: "AM" },
  { city: "Curitiba", state: "PR" },
  { city: "Goiânia", state: "GO" },
  { city: "Belém", state: "PA" },
  { city: "Teresina", state: "PI" },
  { city: "Natal", state: "RN" },
  { city: "João Pessoa", state: "PB" },
  { city: "Campo Grande", state: "MS" },
  { city: "Maceió", state: "AL" },
  { city: "Aracaju", state: "SE" },
  { city: "Cuiabá", state: "MT" },
  { city: "Florianópolis", state: "SC" },
  { city: "Vitória", state: "ES" },
  { city: "Macapá", state: "AP" },
  { city: "Rio Branco", state: "AC" },
  { city: "Boa Vista", state: "RR" },
  { city: "Porto Velho", state: "RO" },
  { city: "São Luís", state: "MA" },
  { city: "Palmas", state: "TO" },
];

export interface RandomPersonOpts {
  /** Percentual masculino 0-100. Default 50. */
  malePercent?: number;
  /** Percentual de toasts mostrando a cidade DETECTADA do usuário 0-100.
   *  Default 0. Quando > 0, precisa de `userLocation` setado. */
  localCityPercent?: number;
  /** Cidade detectada do usuário (via IP geolocation). Null se não
   *  resolvido. */
  userLocation?: { city: string; state: string } | null;
  /** Listas overridden — quando vazias, usa os defaults. */
  malesOverride?: string[];
  femalesOverride?: string[];
  citiesOverride?: Array<{ city: string; state: string }>;
}

/**
 * Sorteia uma pessoa respeitando `malePercent` e `localCityPercent`.
 * - Gênero: random < malePercent/100 → escolhe da lista masculina;
 *   senão feminina.
 * - Cidade: random < localCityPercent/100 E userLocation existe →
 *   usa a cidade do usuário; senão sorteia da lista de cidades.
 */
export function randomPerson(opts: RandomPersonOpts = {}): MarketingPerson {
  const malePercent = clampPct(opts.malePercent, 50);
  const localCityPercent = clampPct(opts.localCityPercent, 0);
  const males = opts.malesOverride?.length
    ? opts.malesOverride
    : DEFAULT_BR_NAMES_MALE;
  const females = opts.femalesOverride?.length
    ? opts.femalesOverride
    : DEFAULT_BR_NAMES_FEMALE;
  const cities = opts.citiesOverride?.length
    ? opts.citiesOverride
    : DEFAULT_BR_CITIES;

  const isMale = Math.random() * 100 < malePercent;
  const pool = isMale ? males : females;
  const name = pool[Math.floor(Math.random() * pool.length)] ?? "Cliente";

  let cityChoice: { city: string; state: string };
  const useLocal =
    !!opts.userLocation && Math.random() * 100 < localCityPercent;
  if (useLocal && opts.userLocation) {
    cityChoice = opts.userLocation;
  } else {
    cityChoice = cities[Math.floor(Math.random() * cities.length)] ?? cities[0];
  }
  return { name, city: cityChoice.city, state: cityChoice.state };
}

function clampPct(value: number | undefined, fallback: number): number {
  const v = typeof value === "number" ? value : fallback;
  return Math.max(0, Math.min(100, v));
}

/**
 * Interpola variáveis na mensagem do toast. Suporta `{name}`, `{city}`,
 * `{state}` — case-sensitive (igual ao padrão Mustache simplificado).
 */
export function renderToastMessage(
  template: string,
  person: MarketingPerson,
): string {
  return template
    .replace(/\{name\}/g, person.name)
    .replace(/\{city\}/g, person.city)
    .replace(/\{state\}/g, person.state);
}

/**
 * Retorna um intervalo random entre [min, max] em segundos —
 * usado pra agendar o próximo toast com tempos variados.
 */
export function randomIntervalMs(minSec: number, maxSec: number): number {
  const a = Math.min(minSec, maxSec);
  const b = Math.max(minSec, maxSec);
  return (a + Math.random() * (b - a)) * 1000;
}
