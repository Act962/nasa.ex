/**
 * Upload de criativos com o mesmo padrão de duas tentativas usado no resto do
 * projeto: presigned PUT e, se falhar (o bucket R2 não tem CORS), POST direto
 * pelo servidor. Vídeo vai pela rota dedicada, que aceita 500 MB.
 */

export async function uploadImage(file: File): Promise<string> {
  // 1ª tentativa: presigned PUT direto no bucket.
  try {
    const presignResponse = await fetch("/api/s3/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        size: file.size,
        isImage: true,
      }),
    });
    if (presignResponse.ok) {
      const { presignedUrl, key } = (await presignResponse.json()) as {
        presignedUrl: string;
        key: string;
      };
      const putResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (putResponse.ok) return key;
    }
  } catch {
    // Cai no fallback — normalmente é CORS do bucket.
  }

  const formData = new FormData();
  formData.append("file", file);
  const directResponse = await fetch("/api/s3/upload-direct", {
    method: "POST",
    body: formData,
  });
  if (!directResponse.ok) {
    const error = (await directResponse.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(error?.error ?? "Falha ao enviar o arquivo.");
  }
  const { key } = (await directResponse.json()) as { key: string };
  return key;
}

export async function uploadVideo(file: File): Promise<string> {
  const response = await fetch("/api/s3/upload-video", {
    method: "POST",
    headers: {
      "x-filename": encodeURIComponent(file.name),
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(error?.error ?? "Falha ao enviar o vídeo.");
  }
  const { key } = (await response.json()) as { key: string };
  return key;
}
