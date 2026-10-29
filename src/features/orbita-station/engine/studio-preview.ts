// Prévia do estúdio do personagem: palco pequeno com o personagem girando no arraste. Usa um renderizador
// próprio porque o reflexo de ambiente pertence a um contexto WebGL e não pode ser dividido entre dois.
import * as THREE from "three";
import type { AvatarLook } from "../lib/avatar-look";
import type { CharacterFactory, CharacterRig } from "./character";
import { createEnvironmentTarget } from "./finish";
import { DEFAULT_ENV_INTENSITY } from "./materials";
import { disposeObject } from "./primitives";

const NO_SHARED_MATERIALS = new Set<THREE.Material>();
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.4;

export class StudioPreview {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  private readonly environmentTarget: THREE.WebGLRenderTarget;
  private readonly keyLight: THREE.SpotLight;
  private readonly floor: THREE.Mesh<THREE.CircleGeometry, THREE.ShadowMaterial>;
  private readonly resizeObserver: ResizeObserver;
  private readonly timer = new THREE.Timer();
  private rig: CharacterRig | null = null;
  private characterHeight = 1.8;
  private yaw = 0;
  private shownYaw = 0;
  private zoom = 1;
  private shownZoom = 1;
  private dragX: number | null = null;
  private pose: string | null = null;
  private frameId = 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly characters: CharacterFactory,
    look: AvatarLook,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.LinearToneMapping;
    const canvas = this.renderer.domElement;
    canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;cursor:grab";
    host.appendChild(canvas);

    this.environmentTarget = createEnvironmentTarget(this.renderer);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = DEFAULT_ENV_INTENSITY;
    // Intensidades do protótipo (r147) vezes π: desde a r155 a luz usa unidades físicas.
    const fill = new THREE.HemisphereLight(0xffffff, 0x2a2838, 0.6 * Math.PI);
    this.keyLight = new THREE.SpotLight(0xffffff, 1.1 * Math.PI, 30, Math.PI / 6, 0.55, 0);
    this.keyLight.position.set(2.5, 7, 5);
    this.keyLight.target.position.set(0, 0.8, 0);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    const rim = new THREE.DirectionalLight(0x9fd8ff, 0.45 * Math.PI);
    rim.position.set(-4, 3, -5);
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(2, 48), new THREE.ShadowMaterial({ opacity: 0.4 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(fill, this.keyLight, this.keyLight.target, rim, this.floor);

    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    canvas.addEventListener("pointercancel", this.handlePointerUp);
    canvas.addEventListener("dblclick", this.handleReset);
    canvas.addEventListener("wheel", this.handleWheel, { passive: false });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);

    this.setLook(look);
    this.resize();
    this.frameId = requestAnimationFrame(this.frame);
  }

  setLook(look: AvatarLook) {
    if (this.rig) disposeObject(this.rig.root, NO_SHARED_MATERIALS);
    this.rig = this.characters.build(look);
    // Capacete e visor pedem outro reflexo: recebem o mapa direto (ver `bindEnvironment` no motor).
    this.rig.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = object.material;
      if (material instanceof THREE.MeshStandardMaterial && material.envMapIntensity !== DEFAULT_ENV_INTENSITY) {
        material.envMap = this.environmentTarget.texture;
      }
    });
    this.rig.setPose(this.pose);
    this.scene.add(this.rig.root);
    this.rig.root.updateMatrixWorld(true);
    this.characterHeight = new THREE.Box3().setFromObject(this.rig.root).getSize(new THREE.Vector3()).y || 1.8;
  }

  /** Pose do estúdio: um clipe do pacote em laço (Parado, Relaxado, Andando…). */
  setPose(clipName: string | null) {
    this.pose = clipName;
    this.rig?.setPose(clipName);
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.handlePointerDown);
    canvas.removeEventListener("pointermove", this.handlePointerMove);
    canvas.removeEventListener("pointerup", this.handlePointerUp);
    canvas.removeEventListener("pointercancel", this.handlePointerUp);
    canvas.removeEventListener("dblclick", this.handleReset);
    canvas.removeEventListener("wheel", this.handleWheel);
    if (this.rig) disposeObject(this.rig.root, NO_SHARED_MATERIALS);
    this.floor.geometry.dispose();
    this.floor.material.dispose();
    this.keyLight.shadow.dispose();
    this.environmentTarget.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
  }

  private resize() {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private readonly frame = (timestamp: number) => {
    this.frameId = requestAnimationFrame(this.frame);
    if (!this.rig || this.host.clientWidth === 0) return;
    this.timer.update(timestamp);
    const delta = Math.min(this.timer.getDelta(), 0.05);
    this.rig.update(delta, false);
    this.shownYaw += (this.yaw - this.shownYaw) * (1 - Math.exp(-delta * 10));
    this.shownZoom += (this.zoom - this.shownZoom) * (1 - Math.exp(-delta * 8));
    this.rig.root.rotation.y = this.shownYaw;
    // Enquadra o corpo inteiro; o zoom aproxima mirando um pouco acima, no rosto e no tronco.
    const targetY = this.characterHeight * (0.5 + (this.shownZoom - 1) * 0.18);
    const distance = (this.characterHeight * 0.74) / Math.tan(THREE.MathUtils.degToRad(14)) / this.shownZoom;
    this.camera.position.set(0, targetY + 0.25, distance);
    this.camera.lookAt(0, targetY, 0);
    this.renderer.render(this.scene, this.camera);
  };

  private readonly handlePointerDown = (event: PointerEvent) => {
    this.dragX = event.clientX;
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (this.dragX === null) return;
    this.yaw += (event.clientX - this.dragX) * 0.012;
    this.dragX = event.clientX;
  };

  private readonly handlePointerUp = () => {
    this.dragX = null;
  };

  private readonly handleReset = () => {
    this.yaw = 0;
    this.zoom = 1;
  };

  private readonly handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.zoom = THREE.MathUtils.clamp(this.zoom * (event.deltaY > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM);
  };
}
