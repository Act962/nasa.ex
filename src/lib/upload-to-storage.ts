// Upload de arquivo para o storage (R2/S3) a partir do navegador. Tenta o PUT
// direto via URL presignada; se falhar (CORS, rede), cai no upload pelo
// servidor (`/api/s3/upload-direct`), com a mesma `key` de saída.

// Tokens de exclusão dos arquivos enviados por esta aba. É o que permite a um
// visitante sem sessão remover o arquivo que acabou de enviar.
const deleteTokensByKey = new Map<string, string>();

function rememberDeleteToken(key: string, deleteToken?: string | null) {
  if (deleteToken) deleteTokensByKey.set(key, deleteToken);
}

export async function deleteFileFromStorage(key: string): Promise<Response> {
  const response = await fetch("/api/s3/delete", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, deleteToken: deleteTokensByKey.get(key) }),
  });
  if (response.ok) deleteTokensByKey.delete(key);
  return response;
}

export async function uploadFileToStorage(
  file: File,
  options: { isImage: boolean; onProgress?: (percent: number) => void },
): Promise<string> {
  const presignedResponse = await fetch("/api/s3/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
      isImage: options.isImage,
    }),
  });

  if (!presignedResponse.ok) {
    const errorBody = await presignedResponse.json().catch(() => ({}));
    throw new Error(
      presignedResponse.status === 503
        ? "Armazenamento S3 não configurado. Preencha as variáveis de ambiente no servidor."
        : (errorBody?.error ?? "Falha ao gerar URL presignada"),
    );
  }

  const { presignedUrl, key, deleteToken } = (await presignedResponse.json()) as {
    presignedUrl: string;
    key: string;
    deleteToken?: string | null;
  };

  const isPresignedUploadOk = await new Promise<boolean>((resolve) => {
    const request = new XMLHttpRequest();
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => resolve(request.status === 200 || request.status === 204);
    request.onerror = () => {
      // O navegador não distingue CORS de outras falhas: o fallback resolve os dois.
      console.warn("[upload] PUT presigned falhou (provável CORS) — tentando pelo servidor");
      resolve(false);
    };
    request.open("PUT", presignedUrl);
    request.setRequestHeader("Content-Type", file.type);
    request.send(file);
  });
  if (isPresignedUploadOk) {
    rememberDeleteToken(key, deleteToken);
    return key;
  }

  options.onProgress?.(0);
  const formData = new FormData();
  formData.append("file", file);
  const directResponse = await fetch("/api/s3/upload-direct", { method: "POST", body: formData });
  if (!directResponse.ok) {
    const errorBody = await directResponse.json().catch(() => ({}));
    throw new Error(errorBody?.error ?? "Falha no upload server-side");
  }
  const direct = (await directResponse.json()) as { key: string; deleteToken?: string | null };
  rememberDeleteToken(direct.key, direct.deleteToken);
  return direct.key;
}
