import { MetaGraphError } from "@/http/meta/planner-graph";
import { ContentPublishError } from "@/modules/social/ports/content-publisher";
import { PublishAccountUnavailableError } from "./instagram-channels";

/** Traduz erro da Graph API para o que o Planner faz com ele (spec 0057): reconectar, tentar de novo ou parar. */

export interface ClassifiedPublishError {
  code: string;
  message: string;
  isRetryable: boolean;
  needsReconnect: boolean;
}

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);
const EXPIRED_TOKEN_CODE = 190;
const PUBLISH_LIMIT_SUBCODE = 2207042;
/** "Media ID is not available": o contêiner ainda não terminou de processar. */
const MEDIA_NOT_READY_SUBCODE = 2207027;

export function classifyPublishError(error: unknown): ClassifiedPublishError {
  if (error instanceof PublishAccountUnavailableError) {
    return { code: "ACCOUNT_UNAVAILABLE", message: error.message, isRetryable: false, needsReconnect: false };
  }
  if (!(error instanceof MetaGraphError) && !(error instanceof ContentPublishError)) {
    const message = error instanceof Error ? error.message : "Erro desconhecido na publicação";
    return { code: "UNKNOWN", message, isRetryable: true, needsReconnect: false };
  }
  if (error.code === EXPIRED_TOKEN_CODE) {
    return {
      code: "TOKEN_EXPIRED",
      message: "A conexão com a Meta expirou ou foi revogada. Reconecte a conta nos Satélites.",
      isRetryable: false,
      needsReconnect: true,
    };
  }
  if (error.subcode === PUBLISH_LIMIT_SUBCODE) {
    return {
      code: "PUBLISH_LIMIT",
      message: "Esta conta atingiu o limite de publicações em 24 horas da Meta. Tente mais tarde.",
      isRetryable: false,
      needsReconnect: false,
    };
  }
  if (error.subcode === MEDIA_NOT_READY_SUBCODE) {
    return { code: "MEDIA_NOT_READY", message: "A Meta ainda está processando a mídia. Vamos tentar de novo.", isRetryable: true, needsReconnect: false };
  }
  if (error.code !== null && RATE_LIMIT_CODES.has(error.code)) {
    return { code: "RATE_LIMIT", message: "A Meta pediu uma pausa nas publicações. Vamos tentar de novo.", isRetryable: true, needsReconnect: false };
  }
  if (error.isTransient) {
    return { code: "TRANSIENT", message: "A Meta ficou instável. Vamos tentar de novo.", isRetryable: true, needsReconnect: false };
  }
  return {
    code: `GRAPH_${error.code ?? "ERR"}${error.subcode ? `_${error.subcode}` : ""}`,
    message: `A Meta recusou a publicação: ${error.message}`,
    isRetryable: false,
    needsReconnect: false,
  };
}
