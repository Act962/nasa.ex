// Partículas do protótipo: poeira nos pés de quem anda e "Zzz" sobre quem está com a estação em outra aba.
// Texturas desenhadas uma vez e compartilhadas; cada partícula tem o próprio material (opacidade), liberado ao sumir.
import * as THREE from "three";
import { FLOOR_TOP } from "../layout/station-layout";

/** Teto de partículas vivas: com muita gente andando, as mais novas esperam a vez em vez de pesar a cena. */
const MAX_PARTICLES = 80;

interface Particle {
  sprite: THREE.Sprite;
  age: number;
  life: number;
  kind: "puff" | "zzz";
  drift: number;
}

function drawTexture(paint: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  paint(canvas.getContext("2d")!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class ParticleEffects {
  private readonly particles: Particle[] = [];
  private readonly puffTexture = drawTexture((context) => {
    const radial = context.createRadialGradient(32, 32, 0, 32, 32, 30);
    radial.addColorStop(0, "rgba(255,255,255,0.9)");
    radial.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = radial;
    context.fillRect(0, 0, 64, 64);
  });
  private readonly zzzTexture = drawTexture((context) => {
    context.font = "bold 46px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineWidth = 6;
    context.strokeStyle = "#2a1b55";
    context.strokeText("Z", 32, 34);
    context.fillStyle = "#e9e7f2";
    context.fillText("Z", 32, 34);
  });

  constructor(
    private readonly scene: THREE.Scene,
    private readonly reduceMotion: boolean,
  ) {}

  puff(x: number, z: number) {
    if (this.reduceMotion || this.particles.length >= MAX_PARTICLES) return;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTexture, color: 0xd9d3ee, transparent: true, depthWrite: false, opacity: 0.6 }));
    sprite.position.set(x + (Math.random() - 0.5) * 0.3, FLOOR_TOP + 0.1, z + (Math.random() - 0.5) * 0.3);
    sprite.scale.setScalar(0.4);
    this.add({ sprite, age: 0, life: 0.5, kind: "puff", drift: 0 });
  }

  zzz(x: number, z: number) {
    if (this.reduceMotion || this.particles.length >= MAX_PARTICLES) return;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.zzzTexture, transparent: true, depthWrite: false }));
    sprite.position.set(x + 0.4, 2.6, z);
    sprite.scale.setScalar(0.5);
    this.add({ sprite, age: 0, life: 2, kind: "zzz", drift: Math.random() * 6 });
  }

  update(delta: number) {
    for (let index = this.particles.length - 1; index >= 0; index--) {
      const particle = this.particles[index];
      particle.age += delta;
      const progress = particle.age / particle.life;
      const material = particle.sprite.material;
      if (particle.kind === "zzz") {
        particle.sprite.position.y += delta * 0.6;
        particle.sprite.position.x += Math.sin(particle.age * 3 + particle.drift) * delta * 0.3;
        material.opacity = 1 - progress;
      } else {
        particle.sprite.scale.setScalar(0.4 + progress * 0.7);
        material.opacity = 0.6 * (1 - progress);
      }
      if (progress >= 1) {
        this.remove(particle);
        this.particles.splice(index, 1);
      }
    }
  }

  dispose() {
    this.particles.forEach((particle) => this.remove(particle));
    this.particles.length = 0;
    this.puffTexture.dispose();
    this.zzzTexture.dispose();
  }

  private add(particle: Particle) {
    this.scene.add(particle.sprite);
    this.particles.push(particle);
  }

  private remove(particle: Particle) {
    particle.sprite.removeFromParent();
    particle.sprite.material.dispose();
  }
}
