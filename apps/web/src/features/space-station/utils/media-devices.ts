/**
 * Utilitários puros para seleção de dispositivos de mídia do World.
 *
 * Regras importantes do domínio:
 * - deviceIds são estáveis por origin/browser (rotacionam só se o usuário
 *   limpar permissões/cookies) — por isso a preferência persiste em
 *   localStorage e NUNCA em banco (não faz sentido cross-device).
 * - `enumerateDevices()` pré-permissão retorna entradas com deviceId/label
 *   vazios (placeholder do Chrome) — filtramos antes de exibir.
 * - `setSinkId` não existe em todos os browsers (Safari) — toda aplicação de
 *   saída passa por feature-detect e falha silenciosa.
 */

/**
 * Retorna o deviceId preferido apenas se ele existe na lista enumerada
 * atual; senão `""` (constraint default do sistema). Não apaga a preferência
 * persistida — o device pode voltar (ex.: headset USB reconectado).
 */
export function resolvePreferredDeviceId(
  preferredDeviceId: string,
  availableDevices: MediaDeviceInfo[],
): string {
  if (!preferredDeviceId) return "";
  const isAvailable = availableDevices.some(
    (deviceInfo) => deviceInfo.deviceId === preferredDeviceId,
  );
  return isAvailable ? preferredDeviceId : "";
}

/**
 * true quando o erro indica que o device pedido não está disponível
 * (desconectado entre a enumeração e o getUserMedia). Nesses casos o caller
 * deve tentar de novo com a constraint default.
 */
export function isDeviceUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "OverconstrainedError" ||
    error.name === "NotFoundError" ||
    error.name === "DevicesNotFoundError"
  );
}

/** Feature-detect global de seleção de saída (`setSinkId`). Safari: false. */
export function supportsAudioOutputSelection(): boolean {
  return (
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype
  );
}

/** Feature-detect do picker nativo de saída (`selectAudioOutput` — Firefox). */
export function supportsSelectAudioOutput(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    "selectAudioOutput" in navigator.mediaDevices
  );
}

/**
 * Abre o picker nativo de saída de áudio (`selectAudioOutput` — Firefox).
 * Retorna o device escolhido ou null (cancelado/sem suporte). Exige gesto
 * do usuário; no Firefox é o único jeito de liberar a lista completa de
 * saídas na enumeração.
 */
export async function selectAudioOutputViaPicker(): Promise<MediaDeviceInfo | null> {
  if (!supportsSelectAudioOutput()) return null;
  const pickerCapableMediaDevices = navigator.mediaDevices as MediaDevices & {
    selectAudioOutput?: () => Promise<MediaDeviceInfo>;
  };
  try {
    return (await pickerCapableMediaDevices.selectAudioOutput?.()) ?? null;
  } catch {
    return null; // usuário cancelou o picker
  }
}

/**
 * Aplica a saída de áudio selecionada num elemento de mídia, com
 * feature-detect e falha silenciosa (browser sem suporte, deviceId stale,
 * elemento já desmontado). `outputDeviceId` vazio é no-op (default do sistema).
 */
export function applySinkId(
  element: HTMLMediaElement,
  outputDeviceId: string,
): void {
  if (!outputDeviceId) return;
  const sinkCapableElement = element as HTMLMediaElement & {
    setSinkId?: (deviceId: string) => Promise<void>;
  };
  if (typeof sinkCapableElement.setSinkId !== "function") return;
  sinkCapableElement.setSinkId(outputDeviceId).catch(() => {
    /* deviceId stale ou sem permissão — mantém a saída atual */
  });
}
