"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  ArrowLeft,
  Image as ImageIcon,
  Video,
  Save,
  ImagePlus,
  X,
  Rocket,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { StepAnnotationEditor } from "./step-annotation-editor";
import type { StepAnnotation } from "@/features/space-help/types";

const MAX_SIZE_MB = 5;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const VIDEO_REGEX = /^(https?:\/\/)?(www\.|player\.)?(youtube\.com|youtu\.be|vimeo\.com)\/.+/i;

interface StepFormState {
  id?: string;
  title: string;
  description: string;
  screenshotUrl: string;
  order: number;
}

const EMPTY_STEP: StepFormState = {
  title: "",
  description: "",
  screenshotUrl: "",
  order: 0,
};

export function FeatureStepsEditor({ featureId }: { featureId: string }) {
  const qc = useQueryClient();
  const [stepForm, setStepForm] = useState<StepFormState>(EMPTY_STEP);
  const [stepFormOpen, setStepFormOpen] = useState(false);
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoDirty, setVideoDirty] = useState(false);
  const [annotatingStep, setAnnotatingStep] = useState<{
    id: string;
    title: string;
    description: string;
    screenshotUrl: string;
    order: number;
    annotations: StepAnnotation[] | null;
  } | null>(null);

  const { data, isLoading } = useQuery({
    ...orpc.spaceHelp.adminGetFeature.queryOptions({ input: { id: featureId } }),
  });

  const featureYoutubeUrl = data?.feature.youtubeUrl ?? null;
  useEffect(() => {
    if (!videoDirty) setVideoUrl(featureYoutubeUrl ?? "");
  }, [featureYoutubeUrl, videoDirty]);

  const upsertStepMut = useMutation({
    ...orpc.spaceHelp.upsertStep.mutationOptions(),
    onSuccess: () => {
      toast.success(stepForm.id ? "Passo atualizado" : "Passo criado");
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminGetFeature.key() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminStats.key() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.getFeature.key() });
      closeStepForm();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const deleteStepMut = useMutation({
    ...orpc.spaceHelp.deleteStep.mutationOptions(),
    onSuccess: () => {
      toast.success("Passo removido");
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminGetFeature.key() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminStats.key() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.getFeature.key() });
      setDeletingStepId(null);
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Erro ao remover");
      setDeletingStepId(null);
    },
  });

  const setVideoMut = useMutation({
    ...orpc.spaceHelp.setYoutubeUrl.mutationOptions(),
    onSuccess: () => {
      toast.success("Vídeo atualizado");
      setVideoDirty(false);
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminGetFeature.key() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.getFeature.key() });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const openCreateStep = () => {
    setStepForm({ ...EMPTY_STEP, order: data?.feature.steps.length ?? 0 });
    setStepFormOpen(true);
  };

  const openEditStep = (s: any) => {
    setStepForm({
      id: s.id,
      title: s.title,
      description: s.description,
      screenshotUrl: s.screenshotUrl ?? "",
      order: s.order,
    });
    setStepFormOpen(true);
  };

  const closeStepForm = () => {
    setStepFormOpen(false);
    setStepForm(EMPTY_STEP);
  };

  const handleSubmitStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stepForm.title.trim() || !stepForm.description.trim()) {
      toast.error("Título e descrição obrigatórios");
      return;
    }
    upsertStepMut.mutate({
      id: stepForm.id,
      featureId,
      title: stepForm.title.trim(),
      description: stepForm.description.trim(),
      screenshotUrl: stepForm.screenshotUrl.trim() || null,
      order: stepForm.order,
    });
  };

  const handleDeleteStep = (id: string, title: string) => {
    if (!confirm(`Remover o passo "${title}"?`)) return;
    setDeletingStepId(id);
    deleteStepMut.mutate({ id });
  };

  const handleSaveVideo = () => {
    const trimmed = videoUrl.trim();
    if (trimmed && !VIDEO_REGEX.test(trimmed)) {
      toast.error("URL inválida — use YouTube ou Vimeo");
      return;
    }
    setVideoMut.mutate({ target: "feature", id: featureId, youtubeUrl: trimmed });
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
        <OrbitaSpinner className="w-5 h-5 mx-auto mb-2" /> Carregando…
      </div>
    );
  }

  if (!data) return null;

  const feature = data.feature;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/space-help/categorias/${feature.category.id}`}
            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
              {feature.category.name}
            </p>
            <h1 className="text-xl font-bold text-foreground">{feature.title}</h1>
            {feature.summary && (
              <p className="text-xs text-muted-foreground mt-0.5">{feature.summary}</p>
            )}
          </div>
        </div>
        <Link
          href={`/space-help/${feature.category.slug}/${feature.slug}`}
          target="_blank"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-info border border-border hover:border-info/30 px-3 py-2 rounded-lg transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Ver na plataforma
        </Link>
      </div>

      {/* Vídeo */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Video className="w-4 h-4 text-info" /> Vídeo (YouTube ou Vimeo)
        </div>
        <div className="flex gap-2">
          <input
            value={videoUrl}
            onChange={(e) => {
              setVideoUrl(e.target.value);
              setVideoDirty(true);
            }}
            placeholder="https://youtube.com/watch?v=... ou https://vimeo.com/..."
            className="flex-1 bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30"
          />
          <button
            onClick={handleSaveVideo}
            disabled={setVideoMut.isPending}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-3.5 py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            {setVideoMut.isPending ? (
              <OrbitaSpinner className="w-4 h-4 " />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar
          </button>
          {feature.youtubeUrl && (
            <button
              onClick={() => {
                setVideoUrl("");
                setVideoDirty(true);
                setVideoMut.mutate({ target: "feature", id: featureId, youtubeUrl: "" });
              }}
              disabled={setVideoMut.isPending}
              className="px-3.5 py-2 text-sm text-muted-foreground hover:text-destructive border border-border hover:border-destructive/30 rounded-lg transition-colors"
            >
              Remover
            </button>
          )}
        </div>
      </div>

      {/* Passos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Passos do tutorial</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cada passo é uma instrução com texto + screenshot opcional.
            </p>
          </div>
          <button
            onClick={openCreateStep}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-3.5 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo passo
          </button>
        </div>

        <div className="space-y-3">
          {feature.steps.map((step: any, idx: number) => (
            <div
              key={step.id}
              className="bg-card border border-border rounded-xl p-5 flex gap-4"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                  {step.description}
                </p>
                {step.screenshotUrl ? (
                  <div className="mt-3 space-y-2 max-w-md">
                    <div className="overflow-hidden rounded-lg border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={step.screenshotUrl}
                        alt={step.title}
                        className="block w-full h-auto"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setAnnotatingStep({
                          id: step.id,
                          title: step.title,
                          description: step.description,
                          screenshotUrl: step.screenshotUrl,
                          order: step.order,
                          annotations: (step.annotations as StepAnnotation[] | null) ?? null,
                        })
                      }
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-destructive/15 hover:bg-destructive/25 border border-destructive/30 text-destructive hover:text-destructive transition-colors"
                    >
                      <Rocket className="w-3.5 h-3.5" />
                      Anotar setas ({step.annotations?.length ?? 0})
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                    <ImageIcon className="w-3 h-3" /> Sem screenshot
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={() => openEditStep(step)}
                  className="p-1.5 text-muted-foreground hover:text-info hover:bg-muted rounded transition-colors"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteStep(step.id, step.title)}
                  disabled={deletingStepId === step.id}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted rounded transition-colors disabled:opacity-50"
                  title="Remover"
                >
                  {deletingStepId === step.id ? (
                    <OrbitaSpinner className="w-4 h-4 " />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}

          {feature.steps.length === 0 && (
            <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
              <p className="text-sm text-muted-foreground">Nenhum passo cadastrado ainda.</p>
              <button
                onClick={openCreateStep}
                className="mt-3 text-xs text-info hover:text-info"
              >
                Criar o primeiro passo →
              </button>
            </div>
          )}
        </div>
      </div>

      {stepFormOpen && (
        <StepFormDialog
          stepId={stepForm.id}
          form={stepForm}
          setForm={setStepForm}
          onSubmit={handleSubmitStep}
          onClose={closeStepForm}
          isPending={upsertStepMut.isPending}
        />
      )}

      {annotatingStep && (
        <StepAnnotationEditor
          open
          onClose={() => setAnnotatingStep(null)}
          step={{ ...annotatingStep, featureId }}
        />
      )}
    </div>
  );
}

function StepFormDialog({
  stepId,
  form,
  setForm,
  onSubmit,
  onClose,
  isPending,
}: {
  stepId?: string;
  form: StepFormState;
  setForm: (f: StepFormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Use JPG, PNG, WebP ou GIF");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Imagem muito grande (máx ${MAX_SIZE_MB}MB)`);
      return;
    }
    setUploading(true);
    try {
      const res = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          isImage: true,
        }),
      });
      if (!res.ok) throw new Error("Falha ao gerar URL de upload");
      const { presignedUrl, key } = await res.json();
      const up = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!up.ok) throw new Error("Falha ao enviar arquivo");
      const publicUrl = `https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}/${key}`;
      setForm({ ...form, screenshotUrl: publicUrl });
      toast.success("Screenshot enviado");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="bg-card border border-border rounded-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-base font-semibold text-foreground">
          {stepId ? "Editar passo" : "Novo passo"}
        </h3>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Título *</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Acesse o menu Configurações"
            className="w-full bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Descrição *</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Detalhe o que o usuário deve fazer neste passo."
            rows={4}
            className="w-full bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30 resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Screenshot</label>

          {form.screenshotUrl ? (
            <div className="space-y-2">
              <div className="overflow-hidden rounded-lg border border-border relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.screenshotUrl} alt="Preview" className="block w-full h-auto" />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, screenshotUrl: "" })}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors"
                  title="Remover"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="text-xs text-info hover:text-info"
              >
                Substituir imagem
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="w-full flex flex-col items-center justify-center gap-2 py-8 bg-muted/50 border border-dashed border-line hover:border-info/30 rounded-lg text-muted-foreground hover:text-info transition-colors"
            >
              {uploading ? (
                <>
                  <OrbitaSpinner className="w-5 h-5 " />
                  <span className="text-xs">Enviando…</span>
                </>
              ) : (
                <>
                  <ImagePlus className="w-5 h-5" />
                  <span className="text-xs">Adicionar screenshot</span>
                  <span className="text-[10px] text-muted-foreground/70">
                    JPG · PNG · WebP · GIF · máx {MAX_SIZE_MB}MB
                  </span>
                </>
              )}
            </button>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={handleFile}
            disabled={uploading}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Ordem</label>
          <input
            type="number"
            value={form.order}
            onChange={(e) => setForm({ ...form, order: Number(e.target.value) || 0 })}
            className="w-full bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-info/30"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending || uploading}
            className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {isPending && <OrbitaSpinner className="w-4 h-4 " />}
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}
