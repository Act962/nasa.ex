// Linhas do mapa da operação: sempre retas, em ângulo reto. Nada de curva atravessando retângulos.

/** Horizontal até a coluna `channelX`, vertical até a altura do destino, horizontal até o destino. */
export function straightPathThrough(params: { sourceX: number; sourceY: number; targetX: number; targetY: number; channelX: number }): string {
  const { sourceX, sourceY, targetX, targetY, channelX } = params;
  return `M ${sourceX} ${sourceY} L ${channelX} ${sourceY} L ${channelX} ${targetY} L ${targetX} ${targetY}`;
}
