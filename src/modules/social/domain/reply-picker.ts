import type { RandomPicker } from "@/modules/shared/ports";
import type { ReplyToCommentConfig } from "./types";

/**
 * Escolhe a variação da resposta pública. Repetir a mesma frase em todos os
 * comentários é o padrão que denuncia um bot — daí a lista de variações
 * (spec 0024 RF-14, CA-10).
 *
 * `SEQUENTIAL` usa o contador de execuções para rodar a lista em ordem; o
 * sorteio verdadeiro fica no `RandomPicker` injetado, o que torna o teste
 * determinístico.
 */
export function pickReplyVariant(
  config: ReplyToCommentConfig,
  picker: RandomPicker,
  sequenceIndex = 0,
): string | undefined {
  const variants = config.variants.filter((variant) => variant.trim().length > 0);
  if (variants.length === 0) return undefined;
  if (variants.length === 1) return variants[0];

  if (config.strategy === "SEQUENTIAL") {
    return variants[sequenceIndex % variants.length];
  }
  return picker.pick(variants);
}
