/**
 * removeBackground — Remoção de fundo client-side via BFS flood-fill.
 * Funciona 100% no browser com Canvas2D API — sem dependências externas.
 *
 * Algoritmo:
 *   1. Coleta a paleta de fundo a partir dos cantos + bordas da imagem
 *   2. BFS 4-conectado a partir de cada pixel de borda que bata com a paleta
 *   3. Pixels alcançados têm o canal alpha zerado (ficam transparentes)
 *
 * O mesmo algoritmo é usado pelo portraitToPipoya para geração de sprites.
 */

function colorDist(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/**
 * Remove o fundo de um canvas IN-PLACE usando BFS flood-fill a partir das bordas.
 * Pixels cuja cor esteja dentro de `tolerance` de qualquer cor de borda amostrada
 * E sejam alcançáveis a partir da borda têm o alpha zerado.
 *
 * @param canvas    HTMLCanvasElement a modificar
 * @param tolerance Limiar de distância de cor (0–255, padrão 32)
 */
export function removeBackground(canvas: HTMLCanvasElement, tolerance = 32): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width: W, height: H } = canvas;
  const imageData = ctx.getImageData(0, 0, W, H);
  const d = imageData.data;

  // Amostra cantos + bordas para montar a paleta de fundo
  const bgColors: [number, number, number][] = [];
  const samplePoints: [number, number][] = [
    [0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1],
    [Math.floor(W / 2), 0],     [Math.floor(W / 2), H - 1],
    [0, Math.floor(H / 2)],     [W - 1, Math.floor(H / 2)],
  ];
  for (const [cx, cy] of samplePoints) {
    const i = (cy * W + cx) * 4;
    if (d[i + 3] > 10) bgColors.push([d[i], d[i + 1], d[i + 2]]);
  }

  function isBg(r: number, g: number, b: number, a: number): boolean {
    if (a < 10) return true; // já transparente
    return bgColors.some(([br, bg, bb]) => colorDist(r, g, b, br, bg, bb) <= tolerance);
  }

  const visited = new Uint8Array(W * H);
  const queue: number[] = [];

  // Semeia BFS a partir de pixels de borda que batem com o fundo
  for (let x = 0; x < W; x++) {
    for (const y of [0, H - 1]) {
      const idx = y * W + x;
      const i = idx * 4;
      if (!visited[idx] && isBg(d[i], d[i + 1], d[i + 2], d[i + 3])) {
        visited[idx] = 1;
        queue.push(idx);
      }
    }
  }
  for (let y = 1; y < H - 1; y++) {
    for (const x of [0, W - 1]) {
      const idx = y * W + x;
      const i = idx * 4;
      if (!visited[idx] && isBg(d[i], d[i + 1], d[i + 2], d[i + 3])) {
        visited[idx] = 1;
        queue.push(idx);
      }
    }
  }

  // BFS — 4-conectado
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    d[idx * 4 + 3] = 0; // torna transparente

    const x = idx % W;
    const y = (idx / W) | 0;
    const neighbors: [number, number][] = [
      [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const nIdx = ny * W + nx;
      if (visited[nIdx]) continue;
      const ni = nIdx * 4;
      if (isBg(d[ni], d[ni + 1], d[ni + 2], d[ni + 3])) {
        visited[nIdx] = 1;
        queue.push(nIdx);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}
