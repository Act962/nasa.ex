"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Youtube,
  Clock,
  Star,
  Sparkles,
  Award,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";

interface FormState {
  id?: string;
  title: string;
  summary: string;
  contentMd: string;
  youtubeUrl: string;
  durationMin: string;
  order: number;
}

const EMPTY_FORM: FormState = {
  title: "",
  summary: "",
  contentMd: "",
  youtubeUrl: "",
  durationMin: "",
  order: 0,
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

export function TrackLessonsEditor({ trackId }: { trackId: string }) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    ...orpc.spaceHelp.adminGetTrack.queryOptions({ input: { id: trackId } }),
  });

  const upsertMut = useMutation({
    ...orpc.spaceHelp.upsertLesson.mutationOptions(),
    onSuccess: () => {
      toast.success(form.id ? "Aula atualizada" : "Aula criada");
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminGetTrack.key() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminListTracks.key() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminStats.key() });
      closeForm();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const deleteMut = useMutation({
    ...orpc.spaceHelp.deleteLesson.mutationOptions(),
    onSuccess: () => {
      toast.success("Aula removida");
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminGetTrack.key() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminListTracks.key() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminStats.key() });
      setDeletingId(null);
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Erro ao remover");
      setDeletingId(null);
    },
  });

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, order: data?.track.lessons.length ?? 0 });
    setFormOpen(true);
  };

  const openEdit = (l: any) => {
    setForm({
      id: l.id,
      title: l.title,
      summary: l.summary ?? "",
      contentMd: l.contentMd ?? "",
      youtubeUrl: l.youtubeUrl ?? "",
      durationMin: l.durationMin?.toString() ?? "",
      order: l.order,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Título obrigatório");
      return;
    }
    upsertMut.mutate({
      id: form.id,
      trackId,
      title: form.title.trim(),
      summary: form.summary.trim() || null,
      contentMd: form.contentMd.trim() || null,
      youtubeUrl: form.youtubeUrl.trim() || null,
      durationMin: form.durationMin ? Number(form.durationMin) : null,
      order: form.order,
    });
  };

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`Remover aula "${title}"?`)) return;
    setDeletingId(id);
    deleteMut.mutate({ id });
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
        <OrbitaSpinner className="w-5 h-5 mx-auto mb-2" /> Carregando…
      </div>
    );
  }

  if (!data) return null;

  const t = data.track;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/space-help/trilhas"
            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t.title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-mono">{t.slug}</span>
              {" · "}
              {LEVEL_LABELS[t.level] ?? t.level}
              {" · "}
              {t.lessons.length} aula(s)
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <RewardChip
          icon={Star}
          label="Stars"
          value={t.rewardStars}
          color="text-warning"
        />
        <RewardChip
          icon={Sparkles}
          label="Space Points"
          value={t.rewardSpacePoints}
          color="text-info"
        />
        <RewardChip
          icon={Clock}
          label="Duração (min)"
          value={t.durationMin ?? 0}
          color="text-success"
        />
        <RewardChip
          icon={Award}
          label="Selo"
          value={t.rewardBadge?.name ?? "—"}
          color="text-warning"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Aulas da trilha</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Organize as aulas em ordem de progressão.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-3.5 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Nova aula
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card border-b border-border">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Ordem</th>
                <th className="px-4 py-3 font-medium">Título</th>
                <th className="px-4 py-3 font-medium text-center">Vídeo</th>
                <th className="px-4 py-3 font-medium text-center">Duração</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {t.lessons.map((l: any) => (
                <tr key={l.id} className="hover:bg-muted transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{l.order}</td>
                  <td className="px-4 py-3">
                    <p className="text-foreground font-medium">{l.title}</p>
                    {l.summary && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {l.summary}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {l.youtubeUrl ? (
                      <Youtube className="w-4 h-4 text-destructive mx-auto" />
                    ) : (
                      <span className="text-[11px] text-muted-foreground/70">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-foreground">
                    {l.durationMin ? `${l.durationMin} min` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(l)}
                        className="p-1.5 text-muted-foreground hover:text-info hover:bg-muted rounded transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(l.id, l.title)}
                        disabled={deletingId === l.id}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted rounded transition-colors disabled:opacity-50"
                        title="Remover"
                      >
                        {deletingId === l.id ? (
                          <OrbitaSpinner className="w-4 h-4 " />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {t.lessons.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Nenhuma aula cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <FormDialog
          title={form.id ? "Editar aula" : "Nova aula"}
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          onClose={closeForm}
          isPending={upsertMut.isPending}
        />
      )}
    </div>
  );
}

function RewardChip({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        {label}
      </div>
      <p className="text-sm font-semibold text-foreground truncate">{value}</p>
    </div>
  );
}

function FormDialog({
  title,
  form,
  setForm,
  onSubmit,
  onClose,
  isPending,
}: {
  title: string;
  form: FormState;
  setForm: (f: FormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="bg-card border border-border rounded-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-base font-semibold text-foreground">{title}</h3>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Título *</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Aula 1 - Visão geral"
            className="w-full bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Resumo</label>
          <textarea
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            placeholder="Descrição curta da aula"
            rows={2}
            className="w-full bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30 resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Conteúdo (markdown)
          </label>
          <textarea
            value={form.contentMd}
            onChange={(e) => setForm({ ...form, contentMd: e.target.value })}
            placeholder="# Introdução&#10;Texto da aula em markdown..."
            rows={6}
            className="w-full bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30 font-mono"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">URL YouTube/Vimeo</label>
            <input
              value={form.youtubeUrl}
              onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })}
              placeholder="https://youtube.com/..."
              className="w-full bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Duração (min)</label>
            <input
              type="number"
              value={form.durationMin}
              onChange={(e) =>
                setForm({ ...form, durationMin: e.target.value })
              }
              placeholder="10"
              className="w-full bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30"
            />
          </div>
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
            disabled={isPending}
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
