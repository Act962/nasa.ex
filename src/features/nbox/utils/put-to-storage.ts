// PUT direto no R2 com progresso. XHR em vez de fetch porque fetch não informa o progresso do envio.

export function putToStorage(params: {
  url: string;
  body: Blob;
  contentType?: string;
  onProgress?: (loadedBytes: number) => void;
}): Promise<{ etag: string | null }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", params.url);
    if (params.contentType) request.setRequestHeader("Content-Type", params.contentType);
    request.upload.onprogress = (event) => params.onProgress?.(event.loaded);
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve({ etag: request.getResponseHeader("ETag")?.replace(/"/g, "") ?? null });
      } else {
        reject(new Error(`O armazenamento recusou o envio (${request.status}).`));
      }
    };
    request.onerror = () => reject(new Error("Falha de conexão no envio."));
    request.send(params.body);
  });
}
