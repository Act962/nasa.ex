import type { Types, Scene } from "phaser";

export function buildGameConfig(
  parent: string,
  width: number,
  height: number,
  scenes: Array<typeof Scene>,
): Types.Core.GameConfig {
  return {
    type: globalThis.Phaser?.AUTO ?? 0,
    width,
    height,
    parent,
    backgroundColor: "#0a0a1a",
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: scenes,
    input: {
      keyboard: {
        // Don't capture keys when focus is on an input element
        capture: [],
      },
    },
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: globalThis.Phaser?.Scale?.RESIZE ?? 4,
      autoCenter: globalThis.Phaser?.Scale?.NO_CENTER ?? 0,
      width,
      height,
      parent,
    },
  };
}
