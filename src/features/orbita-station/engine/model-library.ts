// Modelos 3D servidos de public/orbita-station/models (KayKit — Kay Lousberg; Kenney Space Station Kit —
// www.kenney.nl; ambos CC0). Cada modelo é baixado uma vez; os móveis da cena são clones que dividem a geometria.
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { litMaterial } from "./materials";

const MODELS_URL = "/orbita-station/models";

export const FURNITURE_FILES = {
  chair_A_wood: { file: "chair_A_wood.glb", atlas: "kaykit" },
  "kenney:chair-armrest": { file: "kenney-chair-armrest.glb", atlas: "kenney" },
  "kenney:chair-armrest-headrest": { file: "kenney-chair-armrest-headrest.glb", atlas: "kenney" },
  "kenney:table": { file: "kenney-table.glb", atlas: "kenney" },
  "kenney:table-large": { file: "kenney-table-large.glb", atlas: "kenney" },
  "kenney:container-wide": { file: "kenney-container-wide.glb", atlas: "kenney" },
  "kenney:container-tall": { file: "kenney-container-tall.glb", atlas: "kenney" },
  chair_stool: { file: "chair_stool.glb", atlas: "kaykit" },
  table_medium_long: { file: "table_medium_long.glb", atlas: "kaykit" },
  couch_pillows: { file: "couch_pillows.glb", atlas: "kaykit" },
  "kenney:table-display-planet": { file: "kenney-table-display-planet.glb", atlas: "kenney" },
  cactus_medium_A: { file: "cactus_medium_A.glb", atlas: "kaykit" },
  cactus_medium_B: { file: "cactus_medium_B.glb", atlas: "kaykit" },
} as const;

export type FurnitureName = keyof typeof FURNITURE_FILES;

export const CHARACTER_BODIES = ["Knight", "Rogue", "Ranger", "Mage", "Barbarian"] as const;
export type CharacterBody = (typeof CHARACTER_BODIES)[number];

export interface CharacterAssets {
  models: Record<CharacterBody, THREE.Group>;
  palettes: Record<CharacterBody, ImageBitmap>;
  clips: THREE.AnimationClip[];
  /** GLB do avatar Órbita: só o capacete (Helmet__ / Visor__) é usado. */
  helmet: THREE.Group;
}

async function loadImage(url: string, signal: AbortSignal): Promise<ImageBitmap> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Falha ao baixar ${url} (${response.status})`);
  return createImageBitmap(await response.blob());
}

function markShared(root: THREE.Object3D) {
  root.traverse((object) => {
    object.userData.sharesGeometry = true;
  });
}

export class ModelLibrary {
  private readonly loader = new GLTFLoader();
  private readonly abort = new AbortController();
  private readonly furniture = new Map<FurnitureName, THREE.Group>();
  private readonly ownedTextures: THREE.Texture[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];
  private readonly ownedGeometries = new Set<THREE.BufferGeometry>();
  private readonly bitmaps: ImageBitmap[] = [];
  characters: CharacterAssets | null = null;

  private async loadGltf(url: string): Promise<GLTF> {
    const gltf = await this.loader.loadAsync(url);
    if (this.abort.signal.aborted) throw new DOMException("Carregamento cancelado", "AbortError");
    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      this.ownedGeometries.add(object.geometry);
      // Texturas que vêm dentro do .glb: a cena troca o material, mas a textura original pode já estar na GPU.
      const materials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        Object.values(material).forEach((value) => {
          if (value instanceof THREE.Texture) this.ownedTextures.push(value);
        });
      });
    });
    return gltf;
  }

  async loadFurniture(): Promise<void> {
    const atlasMaterials = new Map<string, THREE.MeshStandardMaterial>();
    await Promise.all(
      ["kaykit", "kenney"].map(async (atlasName) => {
        const bitmap = await loadImage(`${MODELS_URL}/furniture/atlas-${atlasName}.png`, this.abort.signal);
        this.bitmaps.push(bitmap);
        const texture = new THREE.Texture(bitmap);
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        this.ownedTextures.push(texture);
        const material = litMaterial({ map: texture, roughness: 0.65 });
        material.userData.shared = true;
        this.ownedMaterials.push(material);
        atlasMaterials.set(atlasName, material);
      }),
    );
    await Promise.all(
      (Object.entries(FURNITURE_FILES) as [FurnitureName, (typeof FURNITURE_FILES)[FurnitureName]][]).map(async ([name, { file, atlas }]) => {
        // Um móvel que falha não derruba a estação: ele só não aparece (spec 0117, CB-5).
        try {
          const gltf = await this.loadGltf(`${MODELS_URL}/furniture/${file}`);
          gltf.scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            object.material = atlasMaterials.get(atlas)!;
            object.castShadow = true;
            object.receiveShadow = true;
          });
          markShared(gltf.scene);
          this.furniture.set(name, gltf.scene);
        } catch (error) {
          if (!this.abort.signal.aborted) console.warn(`[orbita-station] móvel ${name} indisponível`, error);
        }
      }),
    );
  }

  async loadCharacters(): Promise<void> {
    const [models, palettes, clips, helmet] = await Promise.all([
      Promise.all(CHARACTER_BODIES.map((body) => this.loadGltf(`${MODELS_URL}/characters/${body}.glb`).then((gltf) => gltf.scene))),
      Promise.all(CHARACTER_BODIES.map((body) => loadImage(`${MODELS_URL}/characters/${body}.png`, this.abort.signal))),
      Promise.all([0, 1].map((index) => this.loadGltf(`${MODELS_URL}/characters/animations-${index}.glb`))),
      this.loadGltf(`${MODELS_URL}/characters/orbita-helmet.glb`),
    ]);
    this.bitmaps.push(...palettes);
    // Os personagens da cena são clones: a geometria fica com a biblioteca.
    [...models, helmet.scene].forEach(markShared);
    // As animações também gravam a escala dos ossos e desfariam o encolhimento da cabeça a cada quadro.
    const allClips = clips.flatMap((gltf) => gltf.animations);
    allClips.forEach((clip) => {
      clip.tracks = clip.tracks.filter((track) => !track.name.endsWith(".scale"));
    });
    helmet.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) {
        // Reflexo cheio deixa o capacete branco acima do limite do brilho; o visor fica com mais reflexo.
        object.material.envMapIntensity = object.material.name === "visor" ? 0.8 : 0.25;
        this.ownedMaterials.push(object.material);
      }
    });
    this.characters = {
      models: Object.fromEntries(CHARACTER_BODIES.map((body, index) => [body, models[index]])) as Record<CharacterBody, THREE.Group>,
      palettes: Object.fromEntries(CHARACTER_BODIES.map((body, index) => [body, palettes[index]])) as Record<CharacterBody, ImageBitmap>,
      clips: allClips,
      helmet: helmet.scene,
    };
  }

  hasFurniture(name: FurnitureName): boolean {
    return this.furniture.has(name);
  }

  cloneFurniture(name: FurnitureName): THREE.Object3D | null {
    return this.furniture.get(name)?.clone() ?? null;
  }

  dispose() {
    this.abort.abort();
    this.ownedGeometries.forEach((geometry) => geometry.dispose());
    this.ownedMaterials.forEach((material) => material.dispose());
    this.ownedTextures.forEach((texture) => texture.dispose());
    this.bitmaps.forEach((bitmap) => bitmap.close());
    this.furniture.clear();
    this.characters = null;
  }
}
