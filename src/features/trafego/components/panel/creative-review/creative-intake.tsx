"use client";

import { useRef, useState } from "react";
import { Instagram, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { readCreativeFrames, type CreativeFramesResult } from "@/features/trafego/utils/creative-frames";
import { parseInstagramShortcode } from "@/features/trafego/lib/creative-review/schema";

/**
 * Entrada do criativo (spec 0126, RF-9/RF-10): arquivo ou link de post do
 * Instagram. Lê os quadros no navegador e entrega ao pai, que decide se sobe o
 * arquivo, cria o criativo do pedido ou guarda no rascunho do wizard.
 */

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

type IntakeMode = "file" | "link";

export function CreativeIntake({
  onFile,
  onLink,
  isBusy,
  isLinkEnabled,
  linkDisabledHint,
}: {
  onFile: (file: File, frames: CreativeFramesResult) => Promise<void>;
  onLink: (link: string) => Promise<void>;
  isBusy: boolean;
  isLinkEnabled: boolean;
  linkDisabledHint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<IntakeMode>("file");
  const [link, setLink] = useState("");
  const [isReading, setIsReading] = useState(false);
  const isWorking = isBusy || isReading;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    if (file.size > (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
      toast.error(`O arquivo passa do limite de ${isVideo ? "500 MB" : "20 MB"}.`);
      return;
    }
    setIsReading(true);
    try {
      const frames = await readCreativeFrames(file);
      await onFile(file, frames);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler o arquivo.");
    } finally {
      setIsReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleLink() {
    if (!parseInstagramShortcode(link)) {
      toast.error("Cole o link de um post do Instagram (instagram.com/p/… ou /reel/…).");
      return;
    }
    await onLink(link.trim());
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["file", "link"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs transition",
              mode === option ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {option === "file" ? <Upload className="size-3.5" /> : <Instagram className="size-3.5" />}
            {option === "file" ? "Enviar arquivo" : "Link do Instagram"}
          </button>
        ))}
      </div>

      {mode === "file" ? (
        <button
          type="button"
          disabled={isWorking}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-[20px] border border-dashed px-4 py-8 text-center transition hover:bg-muted/40 disabled:opacity-60"
        >
          {isWorking ? <OrbitaSpinner className="size-5" /> : <Upload className="size-5 text-muted-foreground" />}
          <span className="text-sm font-medium">{isWorking ? "Preparando…" : "Escolher imagem ou vídeo"}</span>
          <span className="text-xs text-muted-foreground">JPG, PNG ou MP4 · 1:1, 4:5 ou 9:16</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </button>
      ) : isLinkEnabled ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://www.instagram.com/p/..."
            className="h-11 rounded-full"
            inputMode="url"
          />
          <Button className="h-11 rounded-full" disabled={isWorking || !link.trim()} onClick={handleLink}>
            {isWorking ? <OrbitaSpinner className="size-4" /> : <Sparkles className="size-4" />}
            Analisar post
          </Button>
        </div>
      ) : (
        <p className="rounded-[16px] bg-muted px-3 py-2.5 text-xs text-muted-foreground">
          {linkDisabledHint ?? "O link só funciona depois que a conta da Meta estiver conectada. Envie o arquivo."}
        </p>
      )}
    </div>
  );
}
