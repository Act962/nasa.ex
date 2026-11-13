// Catálogo da decoração da estação (spec 0118, D-3). Por enquanto todos os itens são grátis: preço e loja entram com o
// fluxo de STARS. Um item com unidades colocadas nunca sai daqui: só ganha `retired` (CB-5).
// Medidas: a pegada no piso já em metros, com a escala aplicada; `offsetX/offsetZ` é quanto o centro do modelo está
// deslocado do pivô dele (alguns modelos do Kenney têm o pivô num canto).
export type DecorCategory = "sala" | "plantas" | "tapetes" | "escritorio" | "espaco";

export const DECOR_CATEGORIES: readonly { key: DecorCategory; label: string }[] = [
  { key: "sala", label: "Sala de estar" },
  { key: "plantas", label: "Plantas" },
  { key: "tapetes", label: "Tapetes" },
  { key: "escritorio", label: "Escritório" },
  { key: "espaco", label: "Estação espacial" },
];

export interface DecorItem {
  key: string;
  name: string;
  category: DecorCategory;
  /** Arquivo em public/orbita-station/models/furniture/. */
  file: string;
  atlas: "kaykit" | "kenney";
  scale: number;
  /** Pegada no piso sem giro, em metros. */
  width: number;
  depth: number;
  offsetX: number;
  offsetZ: number;
  /** Tapete: dá para pisar e para pôr outro item em cima. */
  isWalkable?: boolean;
  retired?: boolean;
}

const kaykit = (key: string, name: string, category: DecorCategory, scale: number, width: number, depth: number, offsetX = 0, offsetZ = 0, isWalkable = false): DecorItem => ({
  key,
  name,
  category,
  file: `${key}.glb`,
  atlas: "kaykit",
  scale,
  width,
  depth,
  offsetX,
  offsetZ,
  isWalkable,
});

const kenney = (model: string, name: string, category: DecorCategory, scale: number, width: number, depth: number, offsetX = 0, offsetZ = 0): DecorItem => ({
  key: `kenney-${model}`,
  name,
  category,
  file: `kenney-${model}.glb`,
  atlas: "kenney",
  scale,
  width,
  depth,
  offsetX,
  offsetZ,
});

// Medidas tiradas dos limites de cada .glb (accessor POSITION) vezes a escala.
export const DECOR_CATALOG: readonly DecorItem[] = [
  kaykit("armchair", "Poltrona", "sala", 0.5, 0.9, 0.8, 0, 0.025),
  kaykit("armchair_pillows", "Poltrona com almofadas", "sala", 0.5, 0.9, 0.8, 0, 0.025),
  kaykit("couch", "Sofá", "sala", 0.5, 1.5, 0.8, 0, 0.025),
  kaykit("couch_pillows", "Sofá com almofadas", "sala", 0.5, 1.5, 0.8, 0, 0.025),
  kaykit("table_low", "Mesa de centro", "sala", 0.5, 1.2, 0.75),
  kaykit("table_small", "Mesinha", "sala", 0.5, 0.5, 0.5),
  kaykit("table_medium", "Mesa quadrada", "sala", 0.5, 1, 1),
  kaykit("lamp_standing", "Luminária de chão", "sala", 0.8, 0.8, 0.8),
  kaykit("shelf_B_large_decorated", "Estante baixa", "sala", 0.8, 1.6, 0.4, 0, 0.2),
  kaykit("shelf_B_small_decorated", "Estante pequena", "sala", 0.8, 0.8, 0.46, 0, 0.229),
  kaykit("cabinet_medium_decorated", "Armário", "sala", 0.6, 1.23, 0.6, 0.013, 0.001),
  kaykit("cabinet_small_decorated", "Armário pequeno", "sala", 0.8, 0.84, 0.88, -0.017, 0.042),
  kaykit("pictureframe_standing_A", "Quadro de pé", "sala", 1.2, 0.6, 0.45, 0, -0.022),
  kaykit("pictureframe_standing_B", "Quadro de pé largo", "sala", 1.2, 0.84, 0.43, 0, -0.008),
  kaykit("cactus_small_A", "Cacto pequeno", "plantas", 1.2, 0.6, 0.6),
  kaykit("cactus_small_B", "Cacto pequeno florido", "plantas", 1.2, 0.6, 0.6),
  kaykit("cactus_medium_A", "Cacto", "plantas", 1.2, 1.06, 1),
  kaykit("cactus_medium_B", "Cacto florido", "plantas", 1.2, 1.06, 1),
  kaykit("rug_oval_A", "Tapete oval", "tapetes", 0.8, 2.4, 1.6, 0, 0, true),
  kaykit("rug_oval_B", "Tapete oval estampado", "tapetes", 0.8, 2.4, 1.6, 0, 0, true),
  kaykit("rug_rectangle_A", "Tapete", "tapetes", 0.8, 2.4, 1.6, 0, 0, true),
  kaykit("rug_rectangle_stripes_A", "Tapete listrado", "tapetes", 0.8, 2.4, 1.6, 0, 0, true),
  kenney("computer-system", "Console", "escritorio", 1.8, 1.62, 1.25, 0, -0.045),
  kenney("computer-wide", "Computador", "escritorio", 1.8, 1.44, 0.96, 0, 0.054),
  kenney("table-display", "Mesa de exibição", "escritorio", 1.8, 2.23, 1.47, 0, 0.067),
  kenney("container-tall", "Contêiner alto", "espaco", 2, 1.2, 1.2),
  kenney("container-wide", "Contêiner", "espaco", 2, 1.2, 1.2),
  kenney("container-flat", "Caixa de carga", "espaco", 2, 1.32, 2.18, 0.06, 0.01),
  kenney("table-display-planet", "Mesa holográfica", "espaco", 2.2, 1.1, 1.1, -0.55, 0.55),
  kenney("rocks", "Pedras lunares", "espaco", 2, 2.22, 2.03, -1.11, 1.03),
];

const BY_KEY = new Map(DECOR_CATALOG.map((item) => [item.key, item]));

export function findDecorItem(itemKey: string): DecorItem | null {
  return BY_KEY.get(itemKey) ?? null;
}

/** Itens que aparecem para escolher (sem os aposentados). */
export const AVAILABLE_DECOR = DECOR_CATALOG.filter((item) => !item.retired);
