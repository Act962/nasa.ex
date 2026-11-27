import { putToStorage } from "./put-to-storage";

// Envio de arquivos do Nbox no navegador (specs 0148 e 0149): pede o link ao servidor, sobe direto no R2
// (em partes acima de 100 MB) e fecha no servidor. Quem chama diz como pedir e fechar (equipe ou link de envio).

const PART_CONCURRENCY = 3;
const PART_ATTEMPTS = 3;

export interface NboxUploadProgress {
  fileName: string;
  fileIndex: number;
  fileCount: number;
  loadedBytes: number;
  totalBytes: number;
}

export interface NboxUploadSummary {
  uploadedCount: number;
  failures: Array<{ fileName: string; message: string }>;
}

export const contentTypeOf = (file: File) => file.type || "application/octet-stream";

async function uploadParts(params: {
  file: File;
  partSize: number;
  partUploadUrls: string[];
  onProgress: (loadedBytes: number) => void;
}): Promise<Array<{ partNumber: number; etag: string }>> {
  const loadedByPart = new Map<number, number>();
  const reportProgress = () => params.onProgress([...loadedByPart.values()].reduce((total, loaded) => total + loaded, 0));
  const parts: Array<{ partNumber: number; etag: string }> = [];
  let nextPartIndex = 0;

  async function uploadNextPart(): Promise<void> {
    while (nextPartIndex < params.partUploadUrls.length) {
      const partIndex = nextPartIndex++;
      const partNumber = partIndex + 1;
      const chunk = params.file.slice(partIndex * params.partSize, (partIndex + 1) * params.partSize);
      let lastError: unknown = null;
      for (let attempt = 1; attempt <= PART_ATTEMPTS; attempt += 1) {
        try {
          const { etag } = await putToStorage({
            url: params.partUploadUrls[partIndex],
            body: chunk,
            onProgress: (loaded) => {
              loadedByPart.set(partNumber, loaded);
              reportProgress();
            },
          });
          if (!etag) throw new Error("O armazenamento não devolveu a confirmação da parte (CORS sem ETag).");
          parts.push({ partNumber, etag });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          loadedByPart.set(partNumber, 0);
        }
      }
      if (lastError) throw lastError;
    }
  }

  await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, params.partUploadUrls.length) }, uploadNextPart));
  return parts;
}

type UploadTicket =
  | { mode: "single"; key: string; uploadUrl: string }
  | { mode: "multipart"; key: string; multipartUploadId: string; partSize: number; partUploadUrls: string[] };

export interface UploadFileEndpoints {
  start: (file: { fileName: string; contentType: string; sizeBytes: number }) => Promise<UploadTicket>;
  complete: (upload: {
    key: string;
    fileName: string;
    contentType: string;
    multipartUploadId?: string;
    parts?: Array<{ partNumber: number; etag: string }>;
  }) => Promise<unknown>;
}

export async function uploadNboxFiles(
  files: File[],
  endpoints: UploadFileEndpoints,
  onProgress: (progress: NboxUploadProgress) => void,
): Promise<NboxUploadSummary> {
  const summary: NboxUploadSummary = { uploadedCount: 0, failures: [] };
  for (const [fileIndex, file] of files.entries()) {
    const reportProgress = (loadedBytes: number) =>
      onProgress({ fileName: file.name, fileIndex, fileCount: files.length, loadedBytes, totalBytes: file.size });
    reportProgress(0);
    try {
      const contentType = contentTypeOf(file);
      const ticket = await endpoints.start({ fileName: file.name, contentType, sizeBytes: file.size });
      if (ticket.mode === "single") {
        await putToStorage({ url: ticket.uploadUrl, body: file, contentType, onProgress: reportProgress });
        await endpoints.complete({ key: ticket.key, fileName: file.name, contentType });
      } else {
        const parts = await uploadParts({
          file,
          partSize: ticket.partSize,
          partUploadUrls: ticket.partUploadUrls,
          onProgress: reportProgress,
        });
        await endpoints.complete({
          key: ticket.key,
          fileName: file.name,
          contentType,
          multipartUploadId: ticket.multipartUploadId,
          parts,
        });
      }
      summary.uploadedCount += 1;
    } catch (error) {
      summary.failures.push({ fileName: file.name, message: error instanceof Error ? error.message : "Erro no envio." });
    }
  }
  return summary;
}
