"use client";

import { useState, useMemo } from "react";
import { Eye, Link as LinkIcon, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { parseVideoUrl } from "@/features/nasa-route/lib/video-url";
import { LessonFormVideoUploader } from "./lesson-form-video-uploader";

interface Props {
  // Estado controlado de cima (lesson-form.tsx)
  videoUrl: string;
  onVideoUrlChange: (v: string) => void;
  // Contexto pro uploader
  courseId: string;
  lessonId: string | undefined; // upload só disponível quando aula já tem id
  lessonTitle: string;
  videoFileKey: string | null;
  videoFileSize: number | null;
}

/**
 * Seção "Vídeo da aula" do form de aula. 2 tabs:
 *   - "Link externo" → YouTube/Vimeo (atual)
 *   - "Upload (R2)" → upload de arquivo pro bucket NASA Route
 *
 * Default tab é decidida pelo estado: se já existe videoFileKey, abre na aba
 * "Upload"; senão, na aba "Link".
 */
export function LessonFormVideoSection({
  videoUrl,
  onVideoUrlChange,
  courseId,
  lessonId,
  lessonTitle,
  videoFileKey,
  videoFileSize,
}: Props) {
  const videoInfo = useMemo(() => parseVideoUrl(videoUrl), [videoUrl]);
  const [tab, setTab] = useState<"link" | "upload">(
    videoFileKey ? "upload" : "link",
  );

  return (
    <div className="space-y-2">
      <Label>Vídeo da aula</Label>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "link" | "upload")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="link" className="gap-1.5">
            <LinkIcon className="size-3.5" />
            Link externo
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-1.5">
            <Upload className="size-3.5" />
            Upload (storage NASA Route)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="link" className="mt-3 space-y-2">
          <Input
            id="lesson-video"
            value={videoUrl}
            onChange={(e) => onVideoUrlChange(e.target.value)}
            placeholder="https://youtube.com/watch?v=… ou https://vimeo.com/…"
          />
          {videoUrl && videoInfo.provider && (
            <p className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
              <Eye className="size-3" />
              Detectado: <strong className="capitalize">{videoInfo.provider}</strong>
              {videoInfo.videoId && <span> · ID: {videoInfo.videoId}</span>}
            </p>
          )}
          {videoUrl && !videoInfo.provider && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              URL não reconhecida. Use links do YouTube ou Vimeo.
            </p>
          )}
          {videoFileKey && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              ⚠️ Definir um link externo aqui vai limpar o vídeo R2 já enviado
              (mas o arquivo continua no storage até cleanup).
            </p>
          )}
        </TabsContent>

        <TabsContent value="upload" className="mt-3">
          {!lessonId ? (
            <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              Salve a aula primeiro pra habilitar upload de vídeo.
            </p>
          ) : (
            <LessonFormVideoUploader
              courseId={courseId}
              lessonId={lessonId}
              lessonTitle={lessonTitle}
              currentVideoFileKey={videoFileKey}
              currentVideoFileSize={videoFileSize}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
