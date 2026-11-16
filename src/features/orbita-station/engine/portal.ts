// Portal de teletransporte do protótipo: o anel surge no chão, o cilindro sobe, e no fim ele some em partículas.
// Na etapa 3 marca a chegada e a saída dos colegas (spec 0120, RF-9). A etapa 4 o reaproveita para os leads.
import * as THREE from "three";
import { FLOOR_TOP } from "../layout/station-layout";
import { glowMaterial } from "./materials";

const RADIUS = 0.72;
const HEIGHT = 2.5;
const PARTICLE_COUNT = 26;
const OPENING_SECONDS = 0.8;
/** Com o portal aberto, tempo até ele começar a fechar sozinho. */
const OPEN_SECONDS = 0.6;
const CLOSING_SECONDS = 0.7;
const COLOR = 0x3de0f0;
const EDGE_COLOR = 0x9ff3ff;

const easeOut = (value: number) => 1 - Math.pow(1 - THREE.MathUtils.clamp(value, 0, 1), 3);

interface PortalCallbacks {
  /** O cilindro terminou de subir: o personagem aparece ou some dentro do clarão. */
  onOpen?: () => void;
  /** O portal sumiu. */
  onDone?: () => void;
}

interface Seed {
  angle: number;
  radius: number;
  speed: number;
  height: number;
}

interface Portal extends PortalCallbacks {
  group: THREE.Group;
  disc: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  tube: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  edge: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  particles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  seeds: Seed[];
  phase: "opening" | "open" | "closing";
  time: number;
}

function drawTexture(width: number, height: number, paint: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d")!);
  return new THREE.CanvasTexture(canvas);
}

/** Todos os portais da cena. Geometrias e texturas são compartilhadas; os materiais são de cada portal (opacidade própria). */
export class PortalEffects {
  private readonly portals = new Set<Portal>();
  private readonly glowTexture = drawTexture(64, 64, (context) => {
    const radial = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    radial.addColorStop(0, "rgba(255,255,255,1)");
    radial.addColorStop(0.45, "rgba(160,245,255,0.55)");
    radial.addColorStop(1, "rgba(61,224,240,0)");
    context.fillStyle = radial;
    context.fillRect(0, 0, 64, 64);
  });
  private readonly beamTexture = drawTexture(4, 64, (context) => {
    const vertical = context.createLinearGradient(0, 64, 0, 0);
    vertical.addColorStop(0, "rgba(255,255,255,0.95)");
    vertical.addColorStop(0.55, "rgba(255,255,255,0.35)");
    vertical.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = vertical;
    context.fillRect(0, 0, 4, 64);
  });
  private readonly geometries = {
    disc: new THREE.CircleGeometry(1, 40),
    ring: new THREE.RingGeometry(0.86, 1, 48),
    tube: new THREE.CylinderGeometry(1, 1, 1, 36, 1, true),
    edge: new THREE.TorusGeometry(1, 0.03, 6, 48),
  };

  constructor(
    private readonly scene: THREE.Scene,
    private readonly reduceMotion: boolean,
  ) {}

  open(x: number, z: number, callbacks: PortalCallbacks = {}) {
    const additive = (parameters: THREE.MeshBasicMaterialParameters) =>
      glowMaterial({ color: COLOR, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...parameters });
    const group = new THREE.Group();
    group.position.set(x, FLOOR_TOP + 0.02, z);
    const disc = new THREE.Mesh(this.geometries.disc, additive({ map: this.glowTexture }));
    disc.rotation.x = -Math.PI / 2;
    const ring = new THREE.Mesh(this.geometries.ring, additive({ color: EDGE_COLOR, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    const tube = new THREE.Mesh(this.geometries.tube, additive({ map: this.beamTexture, side: THREE.DoubleSide }));
    const edge = new THREE.Mesh(this.geometries.edge, additive({ color: EDGE_COLOR }));
    edge.rotation.x = Math.PI / 2;
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({ color: 0xc8fbff, size: 5, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    group.add(disc, ring, tube, edge, particles);
    this.scene.add(group);
    const seeds = Array.from({ length: PARTICLE_COUNT }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 0.35 + Math.random() * 0.6,
      speed: 0.6 + Math.random() * 0.9,
      height: Math.random(),
    }));
    this.portals.add({ group, disc, ring, tube, edge, particles, seeds, phase: "opening", time: 0, ...callbacks });
  }

  update(delta: number, elapsed: number) {
    this.portals.forEach((portal) => {
      portal.time += delta;
      let ringSize: number;
      let rise: number;
      let brightness: number;
      let spread = 0;
      if (portal.phase === "opening") {
        ringSize = easeOut(portal.time / 0.35);
        rise = easeOut((portal.time - 0.25) / 0.55);
        brightness = 0.55 + 0.45 * rise;
        if (portal.time >= OPENING_SECONDS) {
          portal.phase = "open";
          portal.time = 0;
          portal.onOpen?.();
        }
      } else if (portal.phase === "open") {
        ringSize = 1;
        rise = 1;
        brightness = 1 + Math.max(0, OPEN_SECONDS - portal.time) * 0.8;
        if (portal.time >= OPEN_SECONDS) {
          portal.phase = "closing";
          portal.time = 0;
        }
      } else {
        const progress = portal.time / CLOSING_SECONDS;
        rise = 1 - easeOut(progress * 1.4);
        ringSize = 1 - easeOut((progress - 0.35) / 0.65);
        brightness = 1 - progress;
        spread = progress;
        if (progress >= 1) {
          this.remove(portal);
          portal.onDone?.();
          return;
        }
      }
      const pulse = this.reduceMotion ? 1 : 0.9 + Math.sin(elapsed * 9) * 0.1;
      portal.disc.scale.setScalar(Math.max(0.01, ringSize) * RADIUS * 1.25);
      portal.disc.material.opacity = 0.8 * brightness;
      portal.ring.scale.setScalar(Math.max(0.01, ringSize) * RADIUS * (1 + spread * 0.4));
      portal.ring.material.opacity = brightness * pulse;
      const height = Math.max(0.01, rise) * HEIGHT;
      portal.tube.scale.set(RADIUS, height, RADIUS);
      portal.tube.position.y = height / 2;
      portal.tube.material.opacity = 0.55 * brightness * pulse;
      portal.edge.scale.setScalar(RADIUS);
      portal.edge.position.y = height;
      portal.edge.material.opacity = rise > 0.05 ? 0.9 * brightness : 0;
      const positions = portal.particles.geometry.attributes.position;
      portal.seeds.forEach((seed, index) => {
        seed.height = (seed.height + (delta * seed.speed * (1 + spread * 2)) / HEIGHT) % 1;
        const radius = RADIUS * seed.radius * (1 + spread * 0.8);
        const angle = seed.angle + seed.height * 2;
        positions.setXYZ(index, Math.cos(angle) * radius, seed.height * Math.max(height, 0.4), Math.sin(angle) * radius);
      });
      positions.needsUpdate = true;
      portal.particles.material.opacity = Math.min(1, ringSize) * brightness;
    });
  }

  dispose() {
    this.portals.forEach((portal) => this.remove(portal));
    Object.values(this.geometries).forEach((geometry) => geometry.dispose());
    this.glowTexture.dispose();
    this.beamTexture.dispose();
  }

  private remove(portal: Portal) {
    this.scene.remove(portal.group);
    [portal.disc, portal.ring, portal.tube, portal.edge].forEach((mesh) => mesh.material.dispose());
    portal.particles.material.dispose();
    portal.particles.geometry.dispose();
    this.portals.delete(portal);
  }
}
