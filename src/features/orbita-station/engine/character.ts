// Personagem montado com as peças do KayKit Adventurers (todas no mesmo esqueleto) e o capacete do avatar Órbita.
import * as THREE from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import type { AvatarLook } from "../lib/avatar-look";
import { litMaterial } from "./materials";
import type { CharacterAssets, CharacterBody } from "./model-library";

const AVATAR_SCALE = 0.95;
// Cabeça do KayKit reduzida e capacete justo: rente à cabeça e acima dos ombros.
const HEAD_SCALE = 0.6;
const HELMET_WORLD_SCALE = HEAD_SCALE * 1.46;
const HELMET_WORLD_LIFT = HEAD_SCALE * 0.48;
const HELMET_PIVOT = 0.147; // centro do capacete acima da junta da cabeça, no GLB do avatar Órbita

// Partes que o estúdio troca: cada uma vem de um personagem do pacote.
const OUTFIT_PARTS = { top: ["Body", "ArmLeft", "ArmRight"], bottom: ["LegLeft", "LegRight"] } as const;
const HEADWEAR: Record<string, { source: CharacterBody; parts: string[] }> = {
  knight: { source: "Knight", parts: ["Helmet", "HelmetVisor"] },
  mage: { source: "Mage", parts: ["Hat"] },
  bear: { source: "Barbarian", parts: ["BearHat"] },
};
const BEARD_COVERS_MOUTH = new Set<CharacterBody>(["Barbarian"]);
const HAIR_DEFAULT_COLOR: Record<CharacterBody, string> = {
  Knight: "#dcb382",
  Ranger: "#9a5943",
  Rogue: "#9a5943",
  Mage: "#201d1f",
  Barbarian: "#98918a",
};

interface PaletteColors {
  suit?: string;
  trim?: string;
  dark?: string;
  skin?: string;
  cells?: Record<string, string>;
}
type PaletteRole = "suit" | "trim" | "dark" | "skin" | "keep";

export interface CharacterRig {
  root: THREE.Group;
  update: (delta: number, isWalking: boolean) => void;
}

function headMeshOf(scene: THREE.Object3D): THREE.SkinnedMesh {
  let found: THREE.SkinnedMesh | null = null;
  scene.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh && /_Head$/.test(object.name)) found = object;
  });
  if (!found) throw new Error("Modelo do KayKit sem cabeça");
  return found;
}

// A paleta do KayKit é uma grade 8x4 de degradês: cada célula é repintada inteira conforme o que ela veste.
function classifyPaletteCell(red: number, green: number, blue: number): PaletteRole {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 510;
  const saturation = max === min ? 0 : (max - min) / max;
  if (green > red + 20 && green >= blue - 30) return "suit";
  if (saturation < 0.18) return lightness > 0.38 ? "suit" : "dark";
  if (red > green * 1.6 && red > blue * 1.6 && lightness < 0.6) return "suit"; // broche e capa: some no traje
  if (red > green && green > blue && lightness > 0.72) return "skin";
  if (red > green && green >= blue) return "trim";
  return "keep";
}

/**
 * Fábrica de personagens: guarda as cabeças separadas do cabelo e os materiais de paleta já pintados,
 * que são reaproveitados entre personagens e liberados juntos no `dispose`.
 */
export class CharacterFactory {
  private readonly paletteMaterials = new Map<string, THREE.MeshStandardMaterial>();
  private readonly headGeometries = new Map<CharacterBody, { bald: THREE.BufferGeometry; haired: THREE.BufferGeometry }>();
  private readonly ownedObjects: THREE.Object3D[] = [];
  private readonly seamMaterial = litMaterial({ color: 0x4a4f5c });
  private readonly seamGeometry = new THREE.TorusGeometry(0.12, 0.035, 8, 24);

  constructor(private readonly assets: CharacterAssets) {
    this.seamMaterial.userData.shared = true;
    (Object.keys(assets.models) as CharacterBody[]).forEach((body) => this.splitHeadHair(body));
  }

  // Duas versões de cada cabeça. Cabelo, sobrancelhas e barba usam a mesma célula da paleta (linha 0, coluna 1),
  // mas cada um é uma peça solta da malha: separamos pelas peças e por onde ficam. Com capacete a cabeça fica
  // careca; sem ele o cabelo volta. A barba nunca aparece, exceto no Bárbaro, onde vira pele (senão fica um buraco).
  private splitHeadHair(body: CharacterBody) {
    const geometry = headMeshOf(this.assets.models[body]).geometry.clone();
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const index = geometry.index!.array;
    const faceTriangles: number[][] = [];
    const hairTriangles: number[][] = [];
    let skinUv: [number, number] = [0, 0];
    let noseZ = -Infinity;
    for (let i = 0; i < index.length; i += 3) {
      const triangle = [index[i], index[i + 1], index[i + 2]];
      const u = triangle.reduce((sum, vertex) => sum + uv.getX(vertex), 0) / 3;
      const v = triangle.reduce((sum, vertex) => sum + uv.getY(vertex), 0) / 3;
      if (Math.floor(u * 8) === 1 && Math.floor(v * 4) === 0) {
        hairTriangles.push(triangle);
        continue;
      }
      faceTriangles.push(triangle);
      const z = triangle.reduce((sum, vertex) => sum + position.getZ(vertex), 0) / 3;
      if (z > noseZ) {
        noseZ = z;
        skinUv = [u, v];
      }
    }
    const bald = faceTriangles.flat();
    const haired = faceTriangles.flat();
    hairPieces(position, hairTriangles).forEach(({ triangles, box }) => {
      const isBrow = box.min.y > 1.6 && box.max.y < 1.86 && box.min.z > 0.25;
      const isBeard = box.max.y < 1.6;
      if (isBeard && !BEARD_COVERS_MOUTH.has(body)) return;
      if (isBeard) triangles.flat().forEach((vertex) => uv.setXY(vertex, skinUv[0], skinUv[1]));
      if (isBrow || isBeard) bald.push(...triangles.flat());
      haired.push(...triangles.flat());
    });
    const withIndex = (triangles: number[]) => {
      const copy = geometry.clone();
      copy.setIndex(triangles);
      return copy;
    };
    this.headGeometries.set(body, { bald: withIndex(bald), haired: withIndex(haired) });
    geometry.dispose();
  }

  private paletteMaterial(body: CharacterBody, colors: PaletteColors): THREE.MeshStandardMaterial {
    const key = `${body}|${colors.suit}|${colors.trim}|${colors.dark}|${colors.skin}|${JSON.stringify(colors.cells ?? {})}`;
    const cached = this.paletteMaterials.get(key);
    if (cached) return cached;
    const image = this.assets.palettes[body];
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(image, 0, 0);
    const cellWidth = canvas.width / 8;
    const cellHeight = canvas.height / 4;
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 8; column++) {
        const sample = context.getImageData(column * cellWidth + cellWidth / 2, row * cellHeight + cellHeight / 2, 1, 1).data;
        const role = classifyPaletteCell(sample[0], sample[1], sample[2]);
        const color = colors.cells?.[`${row},${column}`] ?? (role === "keep" ? undefined : colors[role]);
        if (!color) continue;
        const gradient = context.createLinearGradient(0, row * cellHeight, 0, (row + 1) * cellHeight);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, `#${new THREE.Color(color).multiplyScalar(0.78).getHexString()}`);
        context.fillStyle = gradient;
        context.fillRect(column * cellWidth, row * cellHeight, cellWidth, cellHeight);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    const material = litMaterial({ map: texture });
    material.userData.shared = true;
    this.paletteMaterials.set(key, material);
    return material;
  }

  build(look: AvatarLook): CharacterRig {
    const assets = this.assets;
    const root = new THREE.Group();
    const bodyName: CharacterBody = "Knight";
    const model = cloneSkinned(assets.models[bodyName]) as THREE.Group;
    model.scale.setScalar(AVATAR_SCALE);
    root.add(model);
    // "dark" claro: as partes escuras do braço somem e o traje fica de mangas longas
    const bodyMaterial = this.paletteMaterial(bodyName, { suit: "#f4f4fa", trim: look.suit, dark: "#d4d7e3", skin: look.skin });
    model.traverse((object) => {
      if (/_Cape$|_Quiver$|_Helmet$|_HelmetVisor$|_Hat$|_BearHat$/.test(object.name)) object.visible = false;
      if (!(object instanceof THREE.Mesh)) return;
      object.material = bodyMaterial;
      object.castShadow = true;
      object.frustumCulled = false;
    });
    const bone = (name: string) => model.getObjectByName(name)!;
    const ownHead = headMeshOf(model);
    // Peça de outro personagem do pacote: mesmo esqueleto, a malha é religada aos ossos deste corpo.
    const graft = (sourceMesh: THREE.SkinnedMesh, material: THREE.Material) => {
      const mesh = new THREE.SkinnedMesh(sourceMesh.geometry, material);
      mesh.userData.sharesGeometry = true;
      mesh.bind(new THREE.Skeleton(sourceMesh.skeleton.bones.map((sourceBone) => bone(sourceBone.name) as THREE.Bone), sourceMesh.skeleton.boneInverses), sourceMesh.bindMatrix);
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      ownHead.parent!.add(mesh);
      return mesh;
    };
    const meshOf = (body: CharacterBody, part: string) => assets.models[body].getObjectByName(`${body}_${part}`) as THREE.SkinnedMesh;
    const wear = (body: CharacterBody, part: string, material: THREE.Material) => {
      if (body !== bodyName) return graft(meshOf(body, part), material);
      const own = model.getObjectByName(`${body}_${part}`) as THREE.Mesh;
      own.material = material;
      own.visible = true;
      return own;
    };

    const clothes: PaletteColors = look.outfitColor !== "original" ? { skin: look.skin, suit: look.outfitColor } : { skin: look.skin };
    const dress = (choice: string, parts: readonly string[]) =>
      parts.forEach((part) => {
        const isSuit = choice === "astronaut";
        const source = (isSuit ? "Knight" : choice) as CharacterBody;
        if (source !== bodyName) model.getObjectByName(`${bodyName}_${part}`)!.visible = false;
        wear(source, part, isSuit ? bodyMaterial : this.paletteMaterial(source, clothes));
      });
    dress(look.top, OUTFIT_PARTS.top);
    dress(look.bottom, OUTFIT_PARTS.bottom);
    if (look.cape !== "none") wear(look.cape as CharacterBody, "Cape", this.paletteMaterial(look.cape as CharacterBody, clothes));
    const headwear = HEADWEAR[look.helmet];
    if (headwear) headwear.parts.forEach((part) => wear(headwear.source, part, this.paletteMaterial(headwear.source, clothes)));

    const faceName = look.face;
    let headMesh: THREE.SkinnedMesh = ownHead;
    if (faceName !== bodyName) {
      headMesh = graft(headMeshOf(assets.models[faceName]), bodyMaterial);
      ownHead.visible = false;
    }
    headMesh.material = this.paletteMaterial(faceName, { skin: look.skin, cells: { "0,1": look.hairColor || HAIR_DEFAULT_COLOR[faceName] } });
    headMesh.geometry = this.headGeometries.get(faceName)![look.helmet !== "sem" ? "bald" : "haired"];
    headMesh.userData.sharesGeometry = true;

    const head = bone("head");
    head.scale.setScalar(HEAD_SCALE);
    const helmet = new THREE.Group();
    assets.helmet.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !/^(Helmet|Visor)__/.test(object.name)) return;
      const piece = object.clone();
      piece.userData.sharesGeometry = true;
      const material = (object.material as THREE.MeshStandardMaterial).clone();
      if (material.name === "suit_primary") material.color.set(look.suit);
      if (material.name === "accent") {
        material.color.set(look.accent);
        material.emissive.set(look.accent);
        material.emissiveIntensity = 0.6;
      }
      piece.material = material;
      piece.castShadow = material.name !== "visor";
      helmet.add(piece);
    });
    // O capacete é filho do osso da cabeça: desfaz a escala da cabeça para manter o tamanho no mundo.
    const helmetScale = HELMET_WORLD_SCALE / HEAD_SCALE;
    helmet.scale.setScalar(helmetScale);
    helmet.position.y = HELMET_WORLD_LIFT / HEAD_SCALE - HELMET_PIVOT * helmetScale;
    helmet.visible = look.helmet === "com";
    head.add(helmet);

    if (look.bottom === "astronaut") {
      // Emenda de traje entre a perna e a bota
      ["lowerlegl", "lowerlegr"].forEach((name) => {
        const ring = new THREE.Mesh(this.seamGeometry, this.seamMaterial);
        ring.userData.sharesGeometry = true;
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.13;
        bone(name).add(ring);
      });
    }

    const mixer = new THREE.AnimationMixer(model);
    const clip = (name: string) => assets.clips.find((candidate) => candidate.name === name)!;
    const actions = { idle: mixer.clipAction(clip("Idle_A")), walk: mixer.clipAction(clip("Walking_A")) };
    actions.idle.play();
    let current: keyof typeof actions = "idle";
    this.ownedObjects.push(root);
    return {
      root,
      update: (delta, isWalking) => {
        const wanted = isWalking ? "walk" : "idle";
        if (wanted !== current) {
          actions[wanted].reset().play();
          actions[current].crossFadeTo(actions[wanted], 0.2, false);
          current = wanted;
        }
        mixer.update(delta);
      },
    };
  }

  dispose() {
    this.paletteMaterials.forEach((material) => {
      material.map?.dispose();
      material.dispose();
    });
    this.paletteMaterials.clear();
    this.headGeometries.forEach(({ bald, haired }) => {
      bald.dispose();
      haired.dispose();
    });
    this.seamGeometry.dispose();
    this.seamMaterial.dispose();
  }
}

function hairPieces(position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, triangles: number[][]) {
  const weldIds = new Map<string, number>();
  const parent: number[] = [];
  const weldOf = (vertex: number) => {
    const key = `${position.getX(vertex).toFixed(4)},${position.getY(vertex).toFixed(4)},${position.getZ(vertex).toFixed(4)}`;
    if (!weldIds.has(key)) {
      weldIds.set(key, parent.length);
      parent.push(parent.length);
    }
    return weldIds.get(key)!;
  };
  const find = (id: number) => {
    while (parent[id] !== id) id = parent[id] = parent[parent[id]];
    return id;
  };
  triangles.forEach((triangle) => {
    const [first, ...rest] = triangle.map(weldOf).map(find);
    rest.forEach((id) => {
      parent[id] = first;
    });
  });
  const pieces = new Map<number, { triangles: number[][]; box: THREE.Box3 }>();
  triangles.forEach((triangle) => {
    const root = find(weldOf(triangle[0]));
    if (!pieces.has(root)) pieces.set(root, { triangles: [], box: new THREE.Box3() });
    const piece = pieces.get(root)!;
    piece.triangles.push(triangle);
    triangle.forEach((vertex) => piece.box.expandByPoint(new THREE.Vector3().fromBufferAttribute(position, vertex)));
  });
  return [...pieces.values()];
}
