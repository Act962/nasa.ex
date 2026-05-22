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
import { Uploader } from "@/components/file-uploader/uploader";
import { useConstructUrl } from "@/hooks/use-construct-url";
import {
  Download,
  ExternalLink,
  File as FileIcon,
  ImageIcon,
  Link as LinkIcon,
  Paperclip,
  PlusIcon,
  XIcon,
} from "lucide-react";

interface LessonAttachment {
  /** Vazio quando o item é novo (ainda não salvo). */
  id?: string;
  kind: "file" | "image" | "link";
  title: string;
  url?: string | null;
  fileKey?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  description?: string | null;
  order: number;
}

interface Lesson {
  id?: string;
  moduleId?: string | null;
  title: string;
  summary?: string | null;
  contentMd?: string | null;
  videoUrl?: string | null;
  videoFileKey?: string | null;
  videoFileSize?: number | null;
  thumbnailKey?: string | null;
  durationMin?: number | null;
  isFreePreview?: boolean;
  awardSp?: number;
  attachments?: LessonAttachment[];
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
  // Thumbnail da aula — chave S3 do bucket principal (não o R2 de vídeos).
  const [thumbnailKey, setThumbnailKey] = useState<string | null>(
    initial?.thumbnailKey ?? null,
  );
  const thumbnailPreviewUrl = useConstructUrl(thumbnailKey || "");
  // Anexos complementares (PDFs, imagens, docs, links) — exibidos pro
  // aluno dentro do player da aula.
  const [attachments, setAttachments] = useState<LessonAttachment[]>(
    () => initial?.attachments ?? [],
  );

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
      thumbnailKey,
      durationMin: durationMin ? Number(durationMin) : null,
      isFreePreview,
      awardSp: Number(awardSp) || 10,
      attachments: attachments.map((a, i) => ({ ...a, order: i })),
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

          {/* Thumbnail da aula — opcional. Aparece como capa na sidebar
              de aulas e no card de listagem. Se vazio, usa placeholder
              (primeira letra do título ou ícone padrão). */}
          <div className="space-y-2">
            <Label>Thumbnail da aula</Label>
            {thumbnailKey ? (
              <div className="relative h-40 w-full overflow-hidden rounded-md border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbnailPreviewUrl}
                  alt="Thumbnail"
                  className="h-full w-full object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute bottom-2 right-2 gap-1"
                  onClick={() => setThumbnailKey(null)}
                >
                  <XIcon className="size-3" />
                  Remover
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                <Uploader
                  fileTypeAccepted="image"
                  onConfirm={(key) => setThumbnailKey(key || null)}
                />
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <ImageIcon className="size-3" />
                  Opcional — se vazio, usa placeholder com o título.
                </p>
              </div>
            )}
          </div>

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

          {/* ── Anexos complementares (arquivos/imagens/links) ─────
              Exibidos pro aluno matriculado dentro do player da aula
              com botões de visualizar/baixar. Sync no save: array
              substitui o atual (criar/atualizar/deletar). */}
          <LessonAttachmentsEditor
            attachments={attachments}
            onChange={setAttachments}
          />

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

// ─── Anexos complementares ────────────────────────────────────────────

function LessonAttachmentsEditor({
  attachments,
  onChange,
}: {
  attachments: LessonAttachment[];
  onChange: (next: LessonAttachment[]) => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  function addUploaded(
    kind: "file" | "image",
    key: string,
    name?: string,
  ) {
    onChange([
      ...attachments,
      {
        kind,
        title: name ?? key.split("/").pop() ?? "Arquivo",
        fileKey: key,
        fileName: name ?? null,
        order: attachments.length,
      },
    ]);
  }

  function addLink() {
    if (!linkUrl.trim()) return;
    onChange([
      ...attachments,
      {
        kind: "link",
        title: linkTitle.trim() || linkUrl.trim(),
        url: linkUrl.trim(),
        order: attachments.length,
      },
    ]);
    setLinkOpen(false);
    setLinkTitle("");
    setLinkUrl("");
  }

  function remove(idx: number) {
    onChange(attachments.filter((_, i) => i !== idx));
  }

  function rename(idx: number, title: string) {
    onChange(
      attachments.map((a, i) => (i === idx ? { ...a, title } : a)),
    );
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Paperclip className="size-3.5" />
        Anexos da aula (opcional)
      </Label>
      <p className="text-[11px] text-muted-foreground">
        Adicione PDFs, imagens, planilhas ou links externos — o aluno
        matriculado pode visualizar e baixar dentro da aula.
      </p>

      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((att, i) => (
            <div
              key={att.id ?? `new-${i}`}
              className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2"
            >
              <span className="shrink-0 text-muted-foreground">
                {att.kind === "image" ? (
                  <ImageIcon className="size-4" />
                ) : att.kind === "link" ? (
                  <LinkIcon className="size-4" />
                ) : (
                  <FileIcon className="size-4" />
                )}
              </span>
              <Input
                value={att.title}
                onChange={(e) => rename(i, e.target.value)}
                className="h-7 flex-1 text-xs"
                placeholder="Título visível pro aluno"
              />
              {att.kind === "link" && att.url && (
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  title="Abrir link"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-destructive hover:text-destructive"
                onClick={() => remove(i)}
                title="Remover anexo"
              >
                <XIcon className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* 3 botões de adicionar: arquivo / imagem / link.
          Cada Uploader fica num wrapper com `relative` + opacidade 0 — o
          input file fica em cima da área visível pra abrir o seletor. */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div className="relative">
          <div className="flex h-9 items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border bg-background text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
            <PlusIcon className="size-3.5" />
            Arquivo (PDF, doc, planilha)
          </div>
          <div className="absolute inset-0 opacity-0">
            <Uploader
              fileTypeAccepted="outros"
              onConfirm={(key, name) => key && addUploaded("file", key, name)}
            />
          </div>
        </div>
        <div className="relative">
          <div className="flex h-9 items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border bg-background text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
            <ImageIcon className="size-3.5" />
            Imagem
          </div>
          <div className="absolute inset-0 opacity-0">
            <Uploader
              fileTypeAccepted="image"
              onConfirm={(key, name) => key && addUploaded("image", key, name)}
            />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => setLinkOpen((v) => !v)}
        >
          <LinkIcon className="size-3.5" />
          Link externo
        </Button>
      </div>

      {/* Mini-form inline pra adicionar link externo */}
      {linkOpen && (
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <Input
            placeholder="Título (ex: Apostila completa)"
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            className="h-8 text-xs"
          />
          <Input
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="h-8 text-xs"
            type="url"
          />
          <div className="flex justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setLinkOpen(false);
                setLinkTitle("");
                setLinkUrl("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={addLink}
              disabled={!linkUrl.trim()}
            >
              Adicionar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Evita warning de import não-usado quando o user só usa file uploader.
void Download;
