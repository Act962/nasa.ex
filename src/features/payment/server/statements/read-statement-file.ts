import "server-only";

import { createHash } from "node:crypto";

/**
 * Impressão digital do arquivo importado. Não impede reimportação — a
 * idempotência real é o identificador de cada transação — mas permite avisar
 * "este extrato já foi importado em tal data" antes do usuário se assustar com
 * "0 transações novas".
 */
export function hashStatementFile(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
