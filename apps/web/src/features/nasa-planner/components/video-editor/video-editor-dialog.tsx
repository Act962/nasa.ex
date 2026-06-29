"use client";

import { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertCircleIcon, Loader2Icon, VideoIcon } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { VideoUploader } from "../video-uploader/video-uploader";
import { VideoPreview } from "../video-uploader/video-preview";
import { VideoClipCard } from "./video-clip-card";
import { VideoEditorToolbar } from "./video-editor-toolbar";
import { useFfmpegEditor, type VideoClip } from "./use-ffmpeg-editor";
import { useAttachVideo, useSaveEditedVideo, useGenerateVideoClip } from "../../hooks/use-nasa-planner";
import { PostMetaEditor } from "../post-meta-editor";

interface PostMeta {
  id: string;
  clientOrgName?: string | null;
  orgProjectId?: string | null;
  orgProject?: { id: string; name: string } | null;
  scheduledAt?: string | null;
  isAd?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postTitle?: string;
  post?: PostMeta | null;
}

async function uploadBlob(blob: Blob, filename: string): Promise<string> {
  const xhr = new XMLHttpRequest();
  return new Promise((resolve, reject) => {
    xhr.open("POST", "/api/s3/upload-video");
    xhr.setRequestHeader("Content-Type", blob.type || "video/mp4");
    xhr.setRequestHeader("Content-Length", String(blob.size));
    xhr.setRequestHeader("x-filename", filename);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText).key as string);
      } else {
        reject(new Error("Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(blob);
  });
}

export function VideoEditorDialog({ open, onOpenChange, postId, postTitle, post }: Props) {
  const {
    clips, processing, progress, loaded,
    loadFFmpeg, addClip, removeClip, reorderClips, mergeClips, removeSilence,
  } = useFfmpegEditor();

  const attachVideo = useAttachVideo();
  const saveEdited = useSaveEditedVideo();
  const generateClip = useGenerateVideoClip();

  const [tab, setTab] = useState("upload");
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [resultVideoKey, setResultVideoKey] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDuration, setAiDuration] = useState("5");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const ensureFFmpeg = async () => {
    if (loaded) return;
    setFfmpegLoading(true);
    try {
      await loadFFmpeg();
    } catch {
      toast.error("Erro ao carregar FFmpeg. Verifique os headers COOP/COEP.");
    } finally {
      setFfmpegLoading(false);
    }
  };

  const handleUploaded = useCallback((key: string, filename: string, durationSeconds?: number) => {
    addClip({ id: uuidv4(), key, filename, durationSeconds });
    setResultVideoKey(null);
  }, [addClip]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = clips.findIndex((c) => c.id === active.id);
      const newIdx = clips.findIndex((c) => c.id === over.id);
      reorderClips(arrayMove(clips, oldIdx, newIdx));
    }
  };

  const handleMerge = async () => {
    await ensureFFmpeg();
    if (!loaded && !ffmpegLoading) return;
    try {
      const blob = await mergeClips();
      const key = await uploadBlob(blob, "merged.mp4");
      setResultVideoKey(key);
      toast.success("Clipes mesclados!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao mesclar");
    }
  };

  const handleRemoveSilence = async () => {
    if (clips.length === 0) { toast.error("Adicione um vídeo primeiro"); return; }
    await ensureFFmpeg();
    try {
      const blob = await removeSilence(clips[0].key);
      const key = await uploadBlob(blob, "no_silence.mp4");
      setResultVideoKey(key);
      toast.success("Silêncio removido!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover silêncio");
    }
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) { toast.error("Digite um prompt para gerar o vídeo"); return; }
    try {
      const result = await generateClip.mutateAsync({
        postId,
        prompt: aiPrompt,
        duration: Number(aiDuration),
        provider: "falai",
      });
      addClip({ id: uuidv4(), key: result.videoKey, filename: "video-ia.mp4" });
      setResultVideoKey(result.videoKey);
    } catch { /* handled by hook */ }
  };

  const handleSave = async () => {
    if (!resultVideoKey) return;
    try {
      await saveEdited.mutateAsync({ postId, finalVideoKey: resultVideoKey });
      toast.success("Vídeo salvo no post!");
      onOpenChange(false);
    } catch { /* handled by hook */ }
  };

  const handleAttachSingle = async (key: string, durationSeconds?: number) => {
    await attachVideo.mutateAsync({ postId, videoKey: key, videoDuration: durationSeconds });
    toast.success("Vídeo anexado ao post!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] sm:max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <VideoIcon className="size-4 text-violet-500" />
            Editor de Vídeo
            {postTitle && <span className="text-sm text-muted-foreground font-normal truncate">— {postTitle}</span>}
          </DialogTitle>
        </DialogHeader>

        <VideoEditorToolbar
          canMerge={clips.length > 1}
          canRemoveSilence={clips.length > 0}
          canSave={!!resultVideoKey}
          processing={processing || saveEdited.isPending}
          onMerge={handleMerge}
          onRemoveSilence={handleRemoveSilence}
          onGenerateAI={() => setTab("ai")}
          onSave={handleSave}
        />

        {processing && (
          <div className="px-5 py-2 shrink-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Processando...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto">
          <Tabs value={tab} onValueChange={setTab} className="h-full">
            <div className="px-5 pt-3">
              <TabsList className="h-8">
                <TabsTrigger value="upload" className="text-xs">Upload</TabsTrigger>
                <TabsTrigger value="timeline" className="text-xs">
                  Timeline
                  {clips.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{clips.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="ai" className="text-xs">Gerar com IA</TabsTrigger>
                {resultVideoKey && <TabsTrigger value="result" className="text-xs">Resultado</TabsTrigger>}
                {post && <TabsTrigger value="details" className="text-xs">Detalhes</TabsTrigger>}
              </TabsList>
            </div>

            <TabsContent value="upload" className="px-5 py-4 space-y-4 mt-0">
              <VideoUploader
                onUploaded={(key, filename, dur) => {
                  handleUploaded(key, filename, dur);
                  // If single file, offer quick attach
                  if (clips.length === 0) {
                    handleAttachSingle(key, dur);
                  }
                }}
              />
              {clips.length > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  {clips.length} clipe(s) na timeline. Vá para Timeline para editar.
                </p>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="px-5 py-4 mt-0 space-y-3">
              {clips.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                  <VideoIcon className="size-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Nenhum clipe adicionado</p>
                  <p className="text-xs text-muted-foreground">Faça upload na aba Upload primeiro</p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={clips.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {clips.map((clip) => (
                        <VideoClipCard key={clip.id} clip={clip} onRemove={removeClip} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {clips.length > 1 && (
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5"
                    onClick={handleMerge}
                    disabled={processing || ffmpegLoading}
                  >
                    {ffmpegLoading ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                    Mesclar {clips.length} clipes em 1 vídeo
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="ai" className="px-5 py-4 mt-0 space-y-4">
              <div className="p-3 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/50 text-xs text-muted-foreground">
                Gera um clipe de vídeo curto com IA (fal.ai Kling). Requer chave fal.ai configurada em Integrações → OpenAI.
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Prompt</Label>
                  <Textarea
                    rows={3}
                    placeholder="Descreva o vídeo que deseja gerar..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Duração</Label>
                  <Select value={aiDuration} onValueChange={setAiDuration}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 segundos</SelectItem>
                      <SelectItem value="5">5 segundos (3★)</SelectItem>
                      <SelectItem value="8">8 segundos</SelectItem>
                      <SelectItem value="10">10 segundos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleGenerateAI}
                  disabled={!aiPrompt.trim() || generateClip.isPending}
                >
                  {generateClip.isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                  Gerar Vídeo — 3 Stars
                </Button>
              </div>
            </TabsContent>

            {resultVideoKey && (
              <TabsContent value="result" className="px-5 py-4 mt-0 space-y-4">
                <VideoPreview videoKey={resultVideoKey} className="aspect-video w-full" label="Resultado" />
                <Button
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={handleSave}
                  disabled={saveEdited.isPending}
                >
                  {saveEdited.isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                  Salvar no Post — 1 Star
                </Button>
              </TabsContent>
            )}
            {post && (
              <TabsContent value="details" className="px-5 py-4 mt-0">
                <PostMetaEditor post={post} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
