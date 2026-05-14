"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { LessonFormVideoSection } from "./lesson-form-video-section";

interface Lesson {
  id?: string;
  moduleId?: string | null;
  title: string;
  summary?: string | null;
  contentMd?: string | null;
  videoUrl?: string | null;
  videoFileKey?: string | null;
  videoFileSize?: number | null;
  durationMin?: number | null;
  isFreePreview?: boolean;
  awardSp?: number;
}

interface ModuleOption {
  id: string;
  title: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  courseId: string;
  modules: ModuleOption[];
  initial?: Lesson;
}

export function LessonForm({ open, onClose, courseId, modules, initial }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!initial?.id;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [contentMd, setContentMd] = useState(initial?.contentMd ?? "");
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? "");
  const [durationMin, setDurationMin] = useState(
    initial?.durationMin?.toString() ?? "",
  );
  const [isFreePreview, setIsFreePreview] = useState(initial?.isFreePreview ?? false);
  const [awardSp, setAwardSp] = useState(initial?.awardSp?.toString() ?? "10");
  const [moduleId, setModuleId] = useState<string>(initial?.moduleId ?? "");

  const upsert = useMutation({
    ...orpc.nasaRoute.creatorUpsertLesson.mutationOptions(),
    onSuccess: () => {
      toast.success(isEdit ? "Aula atualizada!" : "Aula criada!");
      queryClient.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorListCourses.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorGetCourse.queryKey({ input: { courseId } }),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.nasaRoute.getCourseAsStudent.queryKey({ input: { courseId } }),
      });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Não foi possível salvar.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Título é obrigatório.");
      return;
    }
    upsert.mutate({
      id: initial?.id,
      courseId,
      moduleId: moduleId || null,
      title: title.trim(),
      summary: summary.trim() || null,
      contentMd: contentMd.trim() || null,
      videoUrl: videoUrl.trim() || null,
      durationMin: durationMin ? Number(durationMin) : null,
      isFreePreview,
      awardSp: Number(awardSp) || 10,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar aula" : "Nova aula"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lesson-title">Título da aula *</Label>
            <Input
              id="lesson-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lesson-summary">Resumo</Label>
            <Input
              id="lesson-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Uma frase descrevendo o que será coberto"
            />
          </div>

          {modules.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="lesson-module">Módulo</Label>
              <Select value={moduleId || "none"} onValueChange={(v) => setModuleId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem módulo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem módulo (aula solta)</SelectItem>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <LessonFormVideoSection
            videoUrl={videoUrl}
            onVideoUrlChange={setVideoUrl}
            courseId={courseId}
            lessonId={initial?.id}
            lessonTitle={title || "Nova aula"}
            videoFileKey={initial?.videoFileKey ?? null}
            videoFileSize={initial?.videoFileSize ?? null}
          />

          <div className="space-y-2">
            <Label htmlFor="lesson-content">Conteúdo complementar (texto)</Label>
            <Textarea
              id="lesson-content"
              value={contentMd}
              onChange={(e) => setContentMd(e.target.value)}
              rows={5}
              placeholder="Notas, links, exercícios — exibido abaixo do vídeo"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lesson-duration">Duração (min)</Label>
              <Input
                id="lesson-duration"
                type="number"
                min={0}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-sp">Space Points por concluir</Label>
              <Input
                id="lesson-sp"
                type="number"
                min={0}
                max={1000}
                value={awardSp}
                onChange={(e) => setAwardSp(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
            <div>
              <Label htmlFor="free-preview" className="cursor-pointer">
                Aula gratuita (preview)
              </Label>
              <p className="text-xs text-muted-foreground">
                Acessível sem comprar o curso. Use 1-2 aulas para amostrar conteúdo.
              </p>
            </div>
            <Switch
              id="free-preview"
              checked={isFreePreview}
              onCheckedChange={setIsFreePreview}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={upsert.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={upsert.isPending} className="gap-1.5">
              {upsert.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar aula
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
