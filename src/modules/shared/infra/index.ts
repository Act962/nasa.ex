import { randomBytes, randomUUID } from "node:crypto";
import type { Clock, IdGenerator, Logger, RandomPicker } from "../ports";

export const systemClock: Clock = {
  now: () => new Date(),
};

export const uuidIdGenerator: IdGenerator = {
  next: () => randomUUID(),
};

export const cryptoRandomPicker: RandomPicker = {
  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    if (items.length === 1) return items[0];
    // randomInt evita o viés de módulo de `Math.random() * n`.
    const index = randomBytes(4).readUInt32BE(0) % items.length;
    return items[index];
  },
};

export function createConsoleLogger(prefix: string): Logger {
  const format = (message: string) => `[${prefix}] ${message}`;
  return {
    info: (message, meta) => console.log(format(message), meta ?? ""),
    warn: (message, meta) => console.warn(format(message), meta ?? ""),
    error: (message, meta) => console.error(format(message), meta ?? ""),
  };
}
