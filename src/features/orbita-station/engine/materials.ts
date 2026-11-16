import * as THREE from "three";
import type { FloorPattern } from "../layout/room-kinds";

// Cores da estrutura tiradas da interface (índigo espacial, ciano e magenta). Para trocar a marca, mude só aqui.
export const ORBITA_PALETTE = {
  wall: 0x4e4580,
  wallLow: 0x7468ad,
  base: 0x2a1f4d,
  dark: 0x1d1540,
  hull: 0x2b2258,
  hullDark: 0x1a1238,
  panelLine: 0x45366f,
  metal: 0x9c95c8,
  rail: 0xd2cbef,
  doorPanel: 0xd8d2f3,
  white: 0xdcd6ee,
} as const;

/** Reflexo de ambiente padrão. Vira `scene.environmentIntensity` (ver `bindEnvironment` no motor). */
export const DEFAULT_ENV_INTENSITY = 0.22;

export function litMaterial(parameters: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, envMapIntensity: DEFAULT_ENV_INTENSITY, ...parameters });
}

/** Brilhos e etiquetas: sem luz e fora do ajuste de tom, para manter a cor exata e alimentar o bloom. */
export function glowMaterial(parameters: THREE.MeshBasicMaterialParameters = {}): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial(parameters);
  material.toneMapped = false;
  return material;
}

/** Canvas desenhado à mão é cor (sRGB); sem isso fica lavado com a saída sRGB. */
export function canvasTexture(canvas: HTMLCanvasElement, repeat = true): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function createCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  return [canvas, canvas.getContext("2d")!];
}

function sprinkleGrain(context: CanvasRenderingContext2D, size: number, strength: number) {
  for (let i = 0; i < (size * size) / 24; i++) {
    context.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${strength * Math.random()})` : `rgba(255,255,255,${strength * Math.random()})`;
    context.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

// Texturas em tons de cinza claro: multiplicam a cor do material, então servem para qualquer cor da paleta.
function grayTexture(size: number, draw: (context: CanvasRenderingContext2D, size: number) => void): THREE.CanvasTexture {
  const [canvas, context] = createCanvas(size);
  context.fillStyle = "#f2f2f2";
  context.fillRect(0, 0, size, size);
  draw(context, size);
  return canvasTexture(canvas);
}

function createSurfaceTextures() {
  return {
    panels: grayTexture(256, (context, size) => {
      for (let i = 0; i < 2; i++) {
        const shade = context.createLinearGradient(0, 0, 0, size);
        shade.addColorStop(0, "rgba(255,255,255,0.10)");
        shade.addColorStop(1, "rgba(0,0,0,0.10)");
        context.fillStyle = shade;
        context.fillRect(i * 128 + 3, 3, 122, size - 6);
      }
      context.fillStyle = "rgba(10,5,40,0.35)";
      [0, 128].forEach((x) => context.fillRect(x, 0, 3, size));
      context.fillRect(0, 0, size, 3);
      context.fillStyle = "rgba(10,5,40,0.18)";
      context.fillRect(0, 168, size, 2);
      context.fillStyle = "rgba(255,255,255,0.35)";
      [[12, 12], [116, 12], [140, 12], [244, 12], [12, 244], [116, 244], [140, 244], [244, 244]].forEach(([x, y]) => {
        context.beginPath();
        context.arc(x, y, 2.5, 0, Math.PI * 2);
        context.fill();
      });
      sprinkleGrain(context, size, 0.06);
    }),
    plates: grayTexture(256, (context, size) => {
      context.fillStyle = "rgba(10,5,40,0.32)";
      for (let row = 0; row < 2; row++) {
        context.fillRect(0, row * 128, size, 2);
        const offset = row % 2 ? 64 : 0;
        for (let x = offset; x < size + 128; x += 128) context.fillRect(x % size, row * 128, 2, 128);
      }
      context.fillStyle = "rgba(255,255,255,0.3)";
      for (let row = 0; row < 2; row++) for (let x = 0; x < size; x += 16) context.fillRect(x + 6, row * 128 + 6, 2, 2);
      sprinkleGrain(context, size, 0.08);
    }),
    brushed: grayTexture(128, (context, size) => {
      for (let i = 0; i < 220; i++) {
        context.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)";
        context.fillRect(0, Math.random() * size, size, 1);
      }
    }),
  };
}

// Mapeia a textura pela posição no mundo (e não pelas faces do bloco): uma parede de 20 m e uma de 2 m
// mostram painéis do mesmo tamanho, sem esticar.
function useWorldTexture(material: THREE.MeshStandardMaterial, texture: THREE.Texture, tileSize: number) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.worldMap = { value: texture };
    shader.uniforms.worldTile = { value: tileSize };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNormal;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWorldNormal = normalize(mat3(modelMatrix) * objectNormal);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNormal;\nuniform sampler2D worldMap;\nuniform float worldTile;")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec3 worldAxis = abs(vWorldNormal);
        vec2 worldUv = worldAxis.y > max(worldAxis.x, worldAxis.z) ? vWorldPos.xz : (worldAxis.x > worldAxis.z ? vWorldPos.zy : vWorldPos.xy);
        diffuseColor.rgb *= texture2D(worldMap, worldUv / worldTile).rgb;`,
      );
  };
  material.customProgramCacheKey = () => `world-texture-${texture.uuid}-${tileSize}`;
}

function createHazardTexture(): THREE.CanvasTexture {
  const [canvas, context] = createCanvas(64);
  context.fillStyle = "#f2c230";
  context.fillRect(0, 0, 64, 64);
  context.fillStyle = "#1d1d2b";
  for (let i = -64; i < 128; i += 22) {
    context.beginPath();
    context.moveTo(i, 0);
    context.lineTo(i + 11, 0);
    context.lineTo(i + 75, 64);
    context.lineTo(i + 64, 64);
    context.fill();
  }
  return canvasTexture(canvas);
}

function createHallTexture(): THREE.CanvasTexture {
  const [canvas, context] = createCanvas(128);
  context.fillStyle = "#8e93a8";
  context.fillRect(0, 0, 128, 128);
  context.fillStyle = "#7d8299";
  for (let i = 0; i < 16; i += 2) context.fillRect(i * 8, 0, 8, 128);
  return canvasTexture(canvas);
}

export function drawFloorTexture([pattern, base, accent]: readonly [FloorPattern, string, string]): THREE.CanvasTexture {
  const [canvas, context] = createCanvas(256);
  context.fillStyle = base;
  context.fillRect(0, 0, 256, 256);
  context.fillStyle = accent;
  if (pattern === "checker") {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) context.fillRect(i * 32, j * 32, 32, 32);
    context.fillStyle = "rgba(20,10,50,0.14)";
    for (let i = 0; i <= 8; i++) {
      context.fillRect(i * 32 - 1, 0, 2, 256);
      context.fillRect(0, i * 32 - 1, 256, 2);
    }
  } else if (pattern === "planks") {
    for (let i = 0; i < 8; i++) {
      context.globalAlpha = 0.18 + (i % 3) * 0.06;
      context.fillRect(0, i * 32, 256, 32);
      context.globalAlpha = 1;
      context.fillRect(0, i * 32, 256, 3);
      for (let k = 0; k < 3; k++) context.fillRect((i % 2) * 64 + k * 128, i * 32, 3, 32);
    }
    context.strokeStyle = "rgba(60,30,15,0.16)";
    context.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      const y = Math.random() * 256;
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(85, y + Math.random() * 6 - 3, 170, y + Math.random() * 6 - 3, 256, y);
      context.stroke();
    }
  } else if (pattern === "plain") {
    context.globalAlpha = 0.35;
    for (let i = 0; i <= 4; i++) {
      context.fillRect(i * 64 - 1, 0, 2, 256);
      context.fillRect(0, i * 64 - 1, 256, 2);
    }
    context.globalAlpha = 1;
  } else {
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        context.beginPath();
        context.arc(i * 64 + 32, j * 64 + 32, 14, 0, Math.PI * 2);
        context.fill();
      }
  }
  sprinkleGrain(context, 256, 0.05);
  return canvasTexture(canvas);
}

/** Materiais compartilhados da estrutura. Criados uma vez por motor e liberados no `dispose` dele. */
export function createStationMaterials() {
  const surface = createSurfaceTextures();
  const hallTexture = createHallTexture();
  const lit = (color: THREE.ColorRepresentation, metalness: number, roughness: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    litMaterial({ color, metalness, roughness, ...extra });
  const materials = {
    wall: lit(ORBITA_PALETTE.wall, 0.15, 0.7),
    wallLow: lit(ORBITA_PALETTE.wallLow, 0.15, 0.7),
    base: lit(ORBITA_PALETTE.base, 0.3, 0.6),
    dark: lit(ORBITA_PALETTE.dark, 0.3, 0.6),
    white: lit(ORBITA_PALETTE.white, 0, 0.55),
    wood: lit(0x8a5a3b, 0, 0.75),
    woodLight: lit(0xb98457, 0, 0.7),
    metal: lit(ORBITA_PALETTE.metal, 0.75, 0.3),
    rail: lit(ORBITA_PALETTE.rail, 0.7, 0.3),
    doorPanel: lit(ORBITA_PALETTE.doorPanel, 0.45, 0.4),
    hull: lit(ORBITA_PALETTE.hull, 0.4, 0.5),
    hullDark: lit(ORBITA_PALETTE.hullDark, 0.4, 0.55),
    panelLine: lit(ORBITA_PALETTE.panelLine, 0.5, 0.4),
    hall: lit(0xffffff, 0.2, 0.45, { map: hallTexture }),
    hazard: lit(0xffffff, 0, 0.8, { map: createHazardTexture() }),
    // A tela pulsa entre 1,55 e 1,95 de emissão: acima do limiar do bloom, ao contrário das superfícies acesas.
    screen: litMaterial({ color: 0x10303a, emissive: 0x3de0f0, emissiveIntensity: 1.8, roughness: 0.2 }),
    glow: glowMaterial({ color: new THREE.Color(0x3de0f0).multiplyScalar(2.2) }),
  };
  const worldTextured: [THREE.MeshStandardMaterial, THREE.Texture, number][] = [
    [materials.wall, surface.panels, 2.4],
    [materials.wallLow, surface.panels, 2.4],
    [materials.hull, surface.plates, 4],
    [materials.hullDark, surface.plates, 4],
    [materials.base, surface.plates, 3],
    [materials.dark, surface.plates, 3],
    [materials.metal, surface.brushed, 1],
    [materials.rail, surface.brushed, 1],
    [materials.doorPanel, surface.brushed, 1.5],
  ];
  worldTextured.forEach(([material, texture, tileSize]) => useWorldTexture(material, texture, tileSize));
  return { ...materials, textures: [...Object.values(surface), hallTexture, materials.hazard.map!] };
}

export type StationMaterials = ReturnType<typeof createStationMaterials>;
