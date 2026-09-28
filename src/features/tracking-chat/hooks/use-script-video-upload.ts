"use client";

/**
 * Upload do vídeo de um Script (spec 0004).
 *
 * Não usa o `Uploader` global: aquele tem teto de 5MB, passa pelo presign
 * `/api/s3/upload` (20MB) e depende de CORS no bucket — pendência conhecida.
 * Aqui o arquivo vai direto pra nossa rota same-origin, que faz o multipart
 * server-side.
 *
 * O upload roda no **submit** do formulário, nunca no drop: cancelar o
 * dialog não pode deixar objeto órfão no bucket (CB-9).
 */

import { useCallback, useState } from "react";

export const MAX_SCRIPT_VIDEO_BYTES = 16 * 1024 * 1024;
export const ACCEPTED_SCRIPT_VIDEO_MIMETYPE = "video/mp4";

export interface UploadedScriptVideo {
  key: string;
  mimetype: string;
  fileName: string;
  sizeBytes: number | null;
}

/** Motivo de recusa, ou `null` quando o arquivo serve. */
export function validateScriptVideo(file: File): string | null {
  if (file.type !== ACCEPTED_SCRIPT_VIDEO_MIMETYPE) {
    return "Formato não suportado. Envie um vídeo MP4.";
  }
  if (file.size > MAX_SCRIPT_VIDEO_BYTES) {
    return "Vídeo muito grande. O limite é 16MB.";
  }
  return null;
}

export function useScriptVideoUpload() {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const upload = useCallback(
    (file: File): Promise<UploadedScriptVideo> => {
      setIsUploading(true);
      setProgress(0);

      return new Promise<UploadedScriptVideo>((resolve, reject) => {
        const request = new XMLHttpRequest();

        request.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          setProgress(Math.round((event.loaded / event.total) * 100));
        };

        request.onload = () => {
          setIsUploading(false);
          let payload: { key?: string; mimetype?: string; sizeBytes?: number | null; error?: string } = {};
          try {
            payload = JSON.parse(request.responseText);
          } catch {
            reject(new Error("Resposta inválida do servidor"));
            return;
          }
          if (request.status !== 200 || !payload.key) {
            reject(new Error(payload.error ?? "Falha ao enviar o vídeo"));
            return;
          }
          resolve({
            key: payload.key,
            mimetype: payload.mimetype ?? file.type,
            fileName: file.name,
            sizeBytes: payload.sizeBytes ?? file.size,
          });
        };

        request.onerror = () => {
          setIsUploading(false);
          reject(new Error("Falha de rede ao enviar o vídeo"));
        };

        request.open("POST", "/api/s3/upload-script-video");
        request.setRequestHeader("Content-Type", file.type);
        request.send(file);
      });
    },
    [],
  );

  return { upload, progress, isUploading };
}
