import * as Phaser from "phaser";

/**
 * PreloadScene — boot scene que apenas inicia a WorldScene.
 *
 * Importa `Phaser` diretamente (e não via `globalThis.Phaser?.Scene ?? class {}`)
 * porque o módulo é avaliado dinamicamente só client-side, e o pattern
 * baseado em globalThis quebrava silenciosamente: se este módulo era
 * avaliado ANTES de `phaser` ter populado `globalThis.Phaser` (HMR/Turbopack
 * reorder), a classe estendia `class {}` vazia e `super({ key: "PreloadScene" })`
 * virava no-op → key colidia em "default" → scene jamais iniciava → tela preta.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: "PreloadScene" });
  }

  create() {
    this.scene.start("WorldScene");
  }
}
