import "server-only";

// STUB LOCAL — não commitar. @langchain/openai não está instalado no upstream.

const NOT_INSTALLED_MSG =
  "ASTRO RAG indisponível: dependência @langchain/openai não está instalada. Rode `pnpm add @langchain/openai` para habilitar.";

type EmbeddingsLike = {
  embedQuery: (text: string) => Promise<number[]>;
  embedDocuments: (texts: string[]) => Promise<number[][]>;
};

export function getEmbeddings(): EmbeddingsLike {
  throw new Error(NOT_INSTALLED_MSG);
}

export async function embed(_text: string): Promise<number[]> {
  throw new Error(NOT_INSTALLED_MSG);
}

export async function embedBatch(_texts: string[]): Promise<number[][]> {
  throw new Error(NOT_INSTALLED_MSG);
}
