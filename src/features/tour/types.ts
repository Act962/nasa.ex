export type TourPosition = "top" | "bottom" | "left" | "right";

/**
 * Como o passo avança (spec 0046, RF-2). Sem valor, é o tour antigo:
 * só o botão "Próximo", e clicar fora encerra.
 */
export type TourAdvanceOn = "next" | "click" | "input" | "result";

export interface TourStep {
  id: string;
  selector: string;
  title: string;
  message: string;
  position: TourPosition;
  padding?: number;
  pulse?: boolean;
  advanceOn?: TourAdvanceOn;
  route?: string;
  skipWhenPath?: string;
}

export interface TourFinish {
  title: string;
  message: string;
  /** Rótulo do botão quando a tela devolve o link do que foi criado. */
  resultLabel?: string;
}

/** O que a tela avisa ao terminar a ação do guia (ex.: lead salvo). */
export interface TourResult {
  href: string;
  label?: string;
}
