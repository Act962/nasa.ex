// Acabamento: reflexo de ambiente e brilho (bloom). "medio" tem brilho nas telas e no neon; "leve" desenha direto.
// Desce de nível sozinho se o aparelho não sustentar ~40 quadros por segundo (spec 0117, RF-11).
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export type QualityTier = "medio" | "leve";

const SLOW_FRAME_SECONDS = 1 / 40;
const SAMPLE_COUNT = 90;
const SETTLE_MS = 1500;

/** Mapa de reflexo da sala genérica. Devolve o alvo inteiro: liberar só a textura deixaria o alvo na GPU. */
export function createEnvironmentTarget(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = new RoomEnvironment();
  const target = generator.fromScene(environment, 0.04);
  environment.dispose();
  generator.dispose();
  return target;
}

export class FinishPipeline {
  tier: QualityTier = "medio";
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private samples: number[] = [];
  private settledAt = 0;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    private readonly onTierChange: (tier: QualityTier) => void,
  ) {
    // Meio-float guarda cor acima de 1: é o que separa neon (brilha) de piso branco (não brilha).
    const supportsHalfFloat = renderer.extensions.has("EXT_color_buffer_float");
    const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: supportsHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType });
    this.composer = new EffectComposer(renderer, target);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.4, 1.05);
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.setTier("medio");
  }

  setTier(tier: QualityTier) {
    this.tier = tier;
    this.samples = [];
    this.settledAt = performance.now() + SETTLE_MS;
    this.onTierChange(tier);
  }

  setSize(width: number, height: number) {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
  }

  watchSpeed(deltaSeconds: number) {
    if (this.tier === "leve" || document.hidden || performance.now() < this.settledAt) return;
    this.samples.push(deltaSeconds);
    if (this.samples.length < SAMPLE_COUNT) return;
    const average = this.samples.reduce((sum, sample) => sum + sample, 0) / this.samples.length;
    this.samples = [];
    if (average > SLOW_FRAME_SECONDS) this.setTier("leve");
  }

  render() {
    if (this.tier === "leve") this.renderer.render(this.scene, this.camera);
    else this.composer.render();
  }

  dispose() {
    this.bloom.dispose();
    this.composer.dispose();
  }
}
