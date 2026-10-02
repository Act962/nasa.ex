"use client";

import { useRef, useState } from "react";
import { ImageIcon, LinkIcon, Trash2, Upload, VideoIcon } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useAddTrafegoCreative,
  useRemoveTrafegoCreative,
  useSetTrafegoMaterialsProfileLink,
} from "@/features/trafego/hooks/use-trafego-orders";
import { cn } from "@/lib/utils";
import { TechnicalTerm } from "../technical-term";

interface Creative {
  id: string;
  kind: "IMAGE" | "VIDEO";
  url: string;
  fileName: string | null;
  status: "UPLOADED" | "SELECTED" | "REJECTED";
  reviewNote: string | null;
}

interface CreativesManagerProps {
  orderId: string;
  creatives: Creative[];
  maxCreatives: number;
  materialsProfileLink: string | null;
  readOnly: boolean;
}

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

/**
 * Upload de criativos com o mesmo padrão de duas tentativas usado no resto do
 * projeto: presigned PUT e, se falhar (o bucket R2 não tem CORS), POST direto
 * pelo servidor. Vídeo vai pela rota dedicada, que aceita 500 MB.
 */
export function CreativesManager({
  orderId,
  creatives,
  maxCreatives,
  materialsProfileLink,
  readOnly,
}: CreativesManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [profileLink, setProfileLink] = useState(materialsProfileLink ?? "");
  const addCreative = useAddTrafegoCreative();
  const removeCreative = useRemoveTrafegoCreative(orderId);
  const setMaterialsProfileLink = useSetTrafegoMaterialsProfileLink(orderId);

  const isFull = creatives.length >= maxCreatives;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const remaining = maxCreatives - creatives.length;
    const selected = Array.from(files).slice(0, remaining);
    if (selected.length < files.length) {
      toast.warning(`Seu plano permite até ${maxCreatives} imagens ou vídeos.`);
    }

    setIsUploading(true);
    for (const file of selected) {
      try {
        const isVideo = file.type.startsWith("video/");
        const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
        if (file.size > limit) {
          toast.error(
            `"${file.name}" excede o limite de ${isVideo ? "500 MB" : "20 MB"}.`,
          );
          continue;
        }

        const fileKey = isVideo
          ? await uploadVideo(file)
          : await uploadImage(file);

        await addCreative.mutateAsync({
          orderId,
          kind: isVideo ? "VIDEO" : "IMAGE",
          fileKey,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : `Não foi possível enviar "${file.name}".`,
        );
      }
    }
    setIsUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">
            Imagens e vídeos
            <TechnicalTerm term="creative" />
          </h3>
          <p className="text-xs text-muted-foreground">
            {creatives.length} de {maxCreatives} enviados · imagens até 20 MB,
            vídeos até 500 MB
          </p>
        </div>

        {!readOnly && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(event) => handleFiles(event.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-full sm:h-9 sm:w-auto"
              disabled={isFull || isUploading}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? (
                <>
                  <OrbitaSpinner className="mr-1.5 size-4" />
                  Enviando…
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 size-4" />
                  Enviar arquivos
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {!readOnly && (
        <div className="mt-4 flex flex-col gap-2 rounded-[20px] border bg-muted/30 p-2 sm:flex-row sm:items-center sm:rounded-full sm:pl-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 max-sm:px-2 max-sm:py-1.5">
            <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="url"
              value={profileLink}
              onChange={(event) => setProfileLink(event.target.value)}
              placeholder="Já tenho um perfil pronto — cole o link aqui"
              className="min-h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="h-11 rounded-full sm:h-9"
            disabled={setMaterialsProfileLink.isPending}
            onClick={() =>
              setMaterialsProfileLink.mutate(
                { orderId, profileLink: profileLink.trim() || null },
                {
                  onSuccess: () => toast.success("Link de perfil salvo."),
                  onError: (error) => toast.error(error.message),
                },
              )
            }
          >
            Salvar link
          </Button>
        </div>
      )}

      {creatives.length === 0 && !materialsProfileLink ? (
        <div className="mt-4 rounded-[22px] border border-dashed px-6 py-8 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
            <ImageIcon className="size-5 text-muted-foreground" />
          </div>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
            Nenhuma imagem ou vídeo ainda. Envie o que deve aparecer no anúncio.
          </p>
        </div>
      ) : creatives.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
          {creatives.map((creative) => (
            <div
              key={creative.id}
              className={cn(
                "group relative overflow-hidden rounded-[18px] border bg-card",
                creative.status === "REJECTED" && "border-destructive/30",
              )}
            >
              <div className="aspect-video bg-muted">
                {creative.kind === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={creative.url}
                    alt={creative.fileName ?? "Criativo"}
                    className="size-full object-cover"
                  />
                ) : (
                  <video
                    src={creative.url}
                    controls
                    className="size-full object-cover"
                  />
                )}
              </div>

              <div className="flex min-w-0 items-center gap-2 py-1 pr-1 pl-3">
                {creative.kind === "IMAGE" ? (
                  <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <VideoIcon className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate text-xs text-muted-foreground">
                  {creative.fileName ?? "Arquivo"}
                </span>

                {!readOnly && (
                  <button
                    type="button"
                    onClick={() =>
                      removeCreative.mutate(
                        { creativeId: creative.id },
                        {
                          onSuccess: () => toast.success("Arquivo removido."),
                          onError: (error) => toast.error(error.message),
                        },
                      )
                    }
                    className="ml-auto grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
                    aria-label="Remover arquivo"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>

              {creative.reviewNote && (
                <p className="border-t border-destructive/30 bg-destructive/15 px-3 py-2 text-xs text-destructive">
                  {creative.reviewNote}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

async function uploadImage(file: File): Promise<string> {
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

async function uploadVideo(file: File): Promise<string> {
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
