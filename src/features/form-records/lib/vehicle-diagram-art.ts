// Arte do diagrama de veículo (spec 0075, RF-12): a imagem é de terceiros
// (crédito em `public/vehicle-diagrams/CREDITS.md`); aqui só moram as áreas
// clicáveis, nas coordenadas do `viewBox` abaixo.

export type ArtPoint = readonly [number, number];

export interface VehicleArtArea {
  partId: string;
  points: readonly ArtPoint[];
}

export const VEHICLE_ART_WIDTH = 1000;
export const VEHICLE_ART_HEIGHT = 1320;
export const VEHICLE_ART_IMAGE_URL = "/vehicle-diagrams/car.png";
export const VEHICLE_ART_CREDIT = { label: "Desenho: Vecteezy.com", url: "https://www.vecteezy.com" } as const;

const WHEEL_SIDES = 16;
const WHEEL_RADIUS = 55;
/** O lado esquerdo é a vista do lado direito espelhada, uma faixa abaixo. */
const LEFT_SIDE_OFFSET_Y = 320;

const area = (partId: string, ...points: ArtPoint[]): VehicleArtArea => ({ partId, points });

function wheel(partId: string, centerX: number, centerY: number): VehicleArtArea {
  const points = Array.from({ length: WHEEL_SIDES }, (_unused, index): ArtPoint => {
    const angle = (index / WHEEL_SIDES) * Math.PI * 2;
    return [Math.round(centerX + Math.cos(angle) * WHEEL_RADIUS), Math.round(centerY + Math.sin(angle) * WHEEL_RADIUS)];
  });
  return { partId, points };
}

// Lado direito (frente à direita), como está na imagem original.
const RIGHT_SIDE_AREAS: VehicleArtArea[] = [
  area("para-lama-dianteiro-ld", [632, 462], [700, 455], [770, 478], [818, 497], [790, 540], [770, 515], [740, 500], [705, 498], [675, 515], [655, 548], [632, 550]),
  area("para-choque-dianteiro", [790, 545], [835, 530], [835, 565], [785, 580]),
  area("porta-dianteira-ld", [445, 450], [580, 455], [632, 462], [632, 550], [622, 556], [460, 553], [455, 520]),
  area("porta-traseira-ld", [283, 440], [445, 450], [455, 520], [460, 553], [338, 553], [330, 540], [300, 505], [285, 480]),
  area("lateral-traseira-ld", [215, 448], [283, 440], [285, 480], [300, 505], [262, 502], [232, 515], [210, 540], [175, 535], [170, 480]),
  area("para-choque-traseiro", [158, 535], [205, 545], [205, 578], [160, 572]),
  area("soleira-ld", [338, 556], [620, 560], [618, 580], [338, 580]),
  wheel("roda-traseira-ld", 264, 578),
  wheel("roda-dianteira-ld", 717, 578),
];

const toLeftSide = (rightSideArea: VehicleArtArea): VehicleArtArea => ({
  partId: rightSideArea.partId.replace(/-ld$/, "-le"),
  points: rightSideArea.points.map(([x, y]): ArtPoint => [VEHICLE_ART_WIDTH - x, y + LEFT_SIDE_OFFSET_Y]),
});

export const VEHICLE_ART_AREAS: readonly VehicleArtArea[] = [
  // Traseira
  area("tampa-traseira", [247, 97], [405, 97], [432, 140], [432, 178], [222, 178], [222, 140]),
  area("para-choque-traseiro", [178, 180], [475, 180], [472, 235], [440, 250], [215, 250], [180, 235]),
  // Frente
  area("capo", [578, 102], [795, 102], [808, 130], [770, 148], [700, 140], [605, 148], [558, 130]),
  area("para-choque-dianteiro", [542, 170], [828, 170], [826, 232], [800, 250], [570, 250], [545, 232]),
  ...RIGHT_SIDE_AREAS,
  ...RIGHT_SIDE_AREAS.map(toLeftSide),
  // Vista superior (frente à direita)
  area("capo", [700, 1020], [760, 1010], [815, 1060], [832, 1132], [815, 1205], [760, 1255], [700, 1245], [712, 1132]),
  area("teto", [250, 1045], [548, 1035], [555, 1132], [548, 1230], [250, 1220]),
  area("tampa-traseira", [195, 1035], [248, 1032], [250, 1232], [195, 1232], [185, 1132]),
];
