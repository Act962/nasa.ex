/**
 * Janela de validade do link público do Calendário Workspace. Curta
 * intencionalmente (1h) pra forçar o usuário a recompartilhar — reduz o
 * risco de uma URL vazada ficar viva indefinidamente.
 *
 * Pra testes locais, dá pra reduzir temporariamente (ex: 60_000 = 1min).
 */
export const CALENDAR_SHARE_TTL_MS = 60 * 60 * 1000;
