import "server-only";

// Texto de um PDF via `pdf-parse`. Só serve de fallback quando o modelo não
// pode receber o arquivo inteiro (spec 0014, CB-9) — boleto escaneado não tem
// texto e precisa de vision. `pdf-parse` é nativo e pesado: import dinâmico,
// como em `workflows/lib/agent-executors/ai.ts`.

const MAX_CHARS = 20_000;

export async function extractPdfText(bytes: Uint8Array): Promise<string | null> {
  try {
    const { PDFParse } = (await import("pdf-parse")) as unknown as {
      PDFParse: new (options: { data: Buffer | Uint8Array }) => {
        getText: () => Promise<{ text: string; total?: number }>;
      };
    };
    const parsed = await new PDFParse({ data: Buffer.from(bytes) }).getText();
    const text = (parsed.text ?? "").replace(/\n{3,}/g, "\n\n").trim();
    if (text.length < 40) return null;
    return text.slice(0, MAX_CHARS);
  } catch (error) {
    console.warn("[payment/documents] pdf-parse falhou:", error);
    return null;
  }
}
