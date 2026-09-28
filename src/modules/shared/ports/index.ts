/**
 * Ports transversais. Existem sobretudo para tirar o não-determinismo de dentro
 * do domínio: com `Clock` e `RandomPicker` injetados, "responder variando o
 * texto" e "está dentro da janela de 24h" viram testes determinísticos.
 */

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

/** Sorteio injetável — o teste passa um picker fixo e o resultado é previsível. */
export interface RandomPicker {
  pick<T>(items: readonly T[]): T | undefined;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
