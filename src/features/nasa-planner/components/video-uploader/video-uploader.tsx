"use client";

import { useRef, useState } from "react";
import { UploadCloudIcon, VideoIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Props {
  onUploaded: (key: string, filename: string, durationSeconds?: number) => void;
  disabled?: boolean;
}

const ACCEPTED = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];
const MAX_MB = 500;

export function VideoUploader({ onUploaded, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const upload = async (file: File) => {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError("Formato não suportado. Use MP4, MOV ou WebM.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Arquivo muito grande (máx ${MAX_MB} MB).`);
      return;
    }

    setFilename(file.name);
    setProgress(0);

    // Get video duration client-side
    let duration: number | undefined;
    try {
      const url = URL.createObjectURL(file);
      duration = await new Promise<number>((resolve) => {
        const v = document.createElement("video");
        v.src = url;
        v.onloadedmetadata = () => { resolve(Math.round(v.duration)); URL.revokeObjectURL(url); };
        v.onerror = () => { resolve(0); URL.revokeObjectURL(url); };
      });
    } catch {
      duration = undefined;
    }

    // Stream upload via XHR for progress
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/s3/upload-video");
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("Content-Length", String(file.size));
    xhr.setRequestHeader("x-filename", file.name);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const { key } = JSON.parse(xhr.responseText);
        setProgress(null);
        onUploaded(key, file.name, duration);
      } else {
        setError("Erro no upload. Tente novamente.");
        setProgress(null);
      }
    };

    xhr.onerror = () => { setError("Erro de rede."); setProgress(null); };

    xhr.send(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer",
          dragging ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/20" : "border-muted-foreground/25 hover:border-muted-foreground/50",
          disabled && "opacity-50 pointer-events-none",
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="size-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
          <VideoIcon className="size-6 text-violet-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Arraste um vídeo ou clique para selecionar</p>
          <p className="text-xs text-muted-foreground mt-1">MP4, MOV, WebM — até {MAX_MB} MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
        />
      </div>

      {progress !== null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate max-w-[200px]">{filename}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
          <XIcon className="size-3.5 shrink-0" />
          {error}
          <button className="ml-auto" onClick={() => setError(null)}><XIcon className="size-3" /></button>
        </div>
      )}
    </div>
  );
}
