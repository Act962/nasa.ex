const MAX_PARTS = 4;
const MAX_LEN = 500;
const SOFT_LEN = 280;

export function splitForWhatsapp(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const blocks = trimmed
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  let parts = blocks.length > 0 ? blocks : [trimmed];

  parts = parts.flatMap((part) =>
    part.length > MAX_LEN ? splitBySentences(part) : [part],
  );

  if (parts.length > MAX_PARTS) {
    const head = parts.slice(0, MAX_PARTS - 1);
    const tail = parts.slice(MAX_PARTS - 1).join("\n\n");
    parts = [...head, tail];
  }

  return parts.map((p) => (p.length > MAX_LEN ? p.slice(0, MAX_LEN) : p));
}

function splitBySentences(text: string): string[] {
  const sentences = text.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }
    if (current.length + 1 + sentence.length <= SOFT_LEN) {
      current = `${current} ${sentence}`;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
}
