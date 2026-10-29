// Palco das miniaturas: um renderizador pequeno, fora da tela, que fotografa um item da decoração ou o personagem
// vestindo uma opção do estúdio. Cada foto vira uma imagem (data URL) guardada em cache. Contexto WebGL próprio, criado
// só quando a primeira miniatura é pedida e liberado junto com o motor.
import * as THREE from "three";

const WIDTH = 200;
const HEIGHT = 150;

export type CharacterRegion = "head" | "top" | "bottom" | "back" | "full";

/** Enquadramento por parte do corpo, como no protótipo: o osso que centraliza, a distância e de onde a câmera olha. */
const REGIONS: Record<CharacterRegion, { bone: string; lift: number; distance: number; direction: [number, number, number] }> = {
  head: { bone: "head", lift: 0.3, distance: 1.75, direction: [0.35, 0.12, 1] },
  top: { bone: "chest", lift: 0, distance: 2.1, direction: [0.35, 0.12, 1] },
  bottom: { bone: "lowerlegl", lift: 0.12, distance: 2.1, direction: [0.35, 0.1, 1] },
  back: { bone: "chest", lift: -0.2, distance: 3.1, direction: [0.12, 0.2, -1] },
  full: { bone: "hips", lift: 0.05, distance: 3.3, direction: [0.35, 0.12, 1] },
};

export class ThumbnailStage {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, WIDTH / HEIGHT, 0.05, 80);
  private readonly cache = new Map<string, string>();
  private readonly box = new THREE.Box3();
  private readonly center = new THREE.Vector3();
  private readonly size = new THREE.Vector3();

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(WIDTH, HEIGHT, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.LinearToneMapping;
    // Intensidades em unidades físicas (× π), como na estação.
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3550, 0.9 * Math.PI));
    const key = new THREE.DirectionalLight(0xffffff, 0.9 * Math.PI);
    key.position.set(3, 6, 5);
    this.scene.add(key);
  }

  cached(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  /** Item da decoração enquadrado inteiro, de três quartos. O objeto é de quem chama (e liberado por ele). */
  photographObject(key: string, object: THREE.Object3D): string {
    const cached = this.cache.get(key);
    if (cached) return cached;
    this.scene.add(object);
    object.updateMatrixWorld(true);
    this.box.setFromObject(object);
    this.box.getCenter(this.center);
    this.box.getSize(this.size);
    const radius = Math.max(this.size.length() / 2, 0.2);
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 0.95;
    this.camera.position.copy(this.center).add(new THREE.Vector3(0.75, 0.6, 1).normalize().multiplyScalar(distance));
    this.camera.lookAt(this.center);
    const image = this.capture();
    object.removeFromParent();
    this.cache.set(key, image);
    return image;
  }

  /** Personagem enquadrado na parte do corpo que a opção muda. */
  photographCharacter(key: string, root: THREE.Object3D, region: CharacterRegion): string {
    const cached = this.cache.get(key);
    if (cached) return cached;
    this.scene.add(root);
    root.updateMatrixWorld(true);
    const frame = REGIONS[region];
    const bone = root.getObjectByName(frame.bone);
    const target = bone ? bone.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 0.9, 0);
    target.y += frame.lift;
    this.camera.position.copy(target).add(new THREE.Vector3(...frame.direction).normalize().multiplyScalar(frame.distance));
    this.camera.lookAt(target);
    const image = this.capture();
    root.removeFromParent();
    this.cache.set(key, image);
    return image;
  }

  dispose() {
    this.cache.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private capture(): string {
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }
}
