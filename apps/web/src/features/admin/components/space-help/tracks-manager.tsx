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
  Eye,
  EyeOff,
  Loader2,
  ExternalLink,
  Star,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { slugify } from "./slug-utils";

interface FormState {
  id?: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  coverUrl: string;
  level: "beginner" | "intermediate" | "advanced";
  durationMin: string;
  categoryId: string;
  rewardStars: number;
  rewardSpacePoints: number;
  rewardBadgeId: string;
  order: number;
  isPublished: boolean;
}

const EMPTY_FORM: FormState = {
  slug: "",
  title: "",
  subtitle: "",
  description: "",
  coverUrl: "",
  level: "beginner",
  durationMin: "",
  categoryId: "",
  rewardStars: 0,
  rewardSpacePoints: 0,
  rewardBadgeId: "",
  order: 0,
  isPublished: true,
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

export function TracksManager() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    ...orpc.spaceHelp.adminListTracks.queryOptions(),
  });
  const { data: categoriesData } = useQuery({
    ...orpc.spaceHelp.adminListCategories.queryOptions(),
  });
  const { data: badgesData } = useQuery({
    ...orpc.spaceHelp.adminListBadges.queryOptions(),
  });

  const upsertMut = useMutation({
    ...orpc.spaceHelp.upsertTrack.mutationOptions(),
    onSuccess: () => {
      toast.success(form.id ? "Trilha atualizada" : "Trilha criada");
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminListTracks.queryKey() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminStats.queryKey() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.listTracks.queryKey() });
      closeForm();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const deleteMut = useMutation({
    ...orpc.spaceHelp.deleteTrack.mutationOptions(),
    onSuccess: () => {
      toast.success("Trilha removida");
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminListTracks.queryKey() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminStats.queryKey() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.listTracks.queryKey() });
      setDeletingId(null);
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Erro ao remover");
      setDeletingId(null);
    },
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (t: any) => {
    setForm({
      id: t.id,
      slug: t.slug,
      title: t.title,
      subtitle: t.subtitle ?? "",
      description: t.description ?? "",
      coverUrl: t.coverUrl ?? "",
      level: t.level,
      durationMin: t.durationMin?.toString() ?? "",
      categoryId: t.categoryId ?? "",
      rewardStars: t.rewardStars,
      rewardSpacePoints: t.rewardSpacePoints,
      rewardBadgeId: t.rewardBadgeId ?? "",
      order: t.order,
      isPublished: t.isPublished,
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
    const slug = form.slug.trim() || slugify(form.title);
    upsertMut.mutate({
      id: form.id,
      slug,
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      description: form.description.trim() || null,
      coverUrl: form.coverUrl.trim() || null,
      level: form.level,
      durationMin: form.durationMin ? Number(form.durationMin) : null,
      categoryId: form.categoryId || null,
      rewardStars: form.rewardStars,
      rewardSpacePoints: form.rewardSpacePoints,
      rewardBadgeId: form.rewardBadgeId || null,
      order: form.order,
      isPublished: form.isPublished,
    });
  };

  const handleDelete = (id: string, title: string, lessonCount: number) => {
    const msg =
      lessonCount > 0
        ? `A trilha "${title}" tem ${lessonCount} aula(s). Remover apaga tudo. Continuar?`
        : `Remover a trilha "${title}"?`;
    if (!confirm(msg)) return;
    setDeletingId(id);
    deleteMut.mutate({ id });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Trilhas (Rotas de aprendizado)</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Cursos sequenciais com aulas, recompensas (Stars/SP) e selos.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova trilha
        </button>
      </div>

      {isLoading ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-sm text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Carregando…
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 border-b border-zinc-800">
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3 font-medium">Ordem</th>
                <th className="px-4 py-3 font-medium">Título</th>
                <th className="px-4 py-3 font-medium">Nível</th>
                <th className="px-4 py-3 font-medium text-center">Aulas</th>
                <th className="px-4 py-3 font-medium text-center">Recompensa</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {data?.tracks.map((t: any) => (
                <tr key={t.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3 text-zinc-400">{t.order}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/space-help/trilhas/${t.id}`}
                      className="text-white font-medium hover:text-violet-300"
                    >
                      {t.title}
                    </Link>
                    {t.subtitle && (
                      <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">{t.subtitle}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-300 text-xs">
                    {LEVEL_LABELS[t.level] ?? t.level}
                  </td>
                  <td className="px-4 py-3 text-center text-zinc-300">{t._count.lessons}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2 text-xs">
                      {t.rewardStars > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-yellow-400">
                          <Star className="w-3 h-3" /> {t.rewardStars}
                        </span>
                      )}
                      {t.rewardSpacePoints > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-violet-400">
                          <Sparkles className="w-3 h-3" /> {t.rewardSpacePoints}
                        </span>
                      )}
                      {t.rewardStars === 0 && t.rewardSpacePoints === 0 && (
                        <span className="text-zinc-600">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {t.isPublished ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        <Eye className="w-3 h-3" /> Publicada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
                        <EyeOff className="w-3 h-3" /> Rascunho
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/space-help/trilhas/${t.slug}`}
                        target="_blank"
                        className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                        title="Ver na plataforma"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => openEdit(t)}
                        className="p-1.5 text-zinc-500 hover:text-violet-300 hover:bg-zinc-800 rounded transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <Link
                        href={`/admin/space-help/trilhas/${t.id}`}
                        className="p-1.5 text-zinc-500 hover:text-violet-300 hover:bg-zinc-800 rounded transition-colors"
                        title="Editar aulas"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(t.id, t.title, t._count.lessons)}
                        disabled={deletingId === t.id}
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"
                        title="Remover"
                      >
                        {deletingId === t.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.tracks.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-500">
                    Nenhuma trilha cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <FormDialog
          title={form.id ? "Editar trilha" : "Nova trilha"}
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          onClose={closeForm}
          isPending={upsertMut.isPending}
          categories={categoriesData?.categories ?? []}
          badges={badgesData?.badges ?? []}
        />
      )}
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
  categories,
  badges,
}: {
  title: string;
  form: FormState;
  setForm: (f: FormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  isPending: boolean;
  categories: Array<{ id: string; name: string }>;
  badges: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-base font-semibold text-white">{title}</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Título *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Setup Inicial NASA"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Slug</label>
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder={slugify(form.title) || "setup-inicial-nasa"}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60 font-mono"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400">Subtítulo</label>
          <input
            value={form.subtitle}
            onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
            placeholder="Configure sua plataforma em 5 passos"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400">Descrição</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60 resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400">URL da capa</label>
          <input
            value={form.coverUrl}
            onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
            placeholder="https://…/imagem.jpg"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Nível</label>
            <select
              value={form.level}
              onChange={(e) =>
                setForm({ ...form, level: e.target.value as FormState["level"] })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/60"
            >
              <option value="beginner">Iniciante</option>
              <option value="intermediate">Intermediário</option>
              <option value="advanced">Avançado</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Duração (min)</label>
            <input
              type="number"
              value={form.durationMin}
              onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
              placeholder="30"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/60"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Categoria</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/60"
            >
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Stars</label>
            <input
              type="number"
              min={0}
              value={form.rewardStars}
              onChange={(e) =>
                setForm({ ...form, rewardStars: Number(e.target.value) || 0 })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/60"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Space Points</label>
            <input
              type="number"
              min={0}
              value={form.rewardSpacePoints}
              onChange={(e) =>
                setForm({ ...form, rewardSpacePoints: Number(e.target.value) || 0 })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/60"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Selo</label>
            <select
              value={form.rewardBadgeId}
              onChange={(e) => setForm({ ...form, rewardBadgeId: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/60"
            >
              <option value="">Sem selo</option>
              {badges.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="space-y-1.5 flex-1">
            <label className="text-xs font-medium text-zinc-400">Ordem</label>
            <input
              type="number"
              value={form.order}
              onChange={(e) => setForm({ ...form, order: Number(e.target.value) || 0 })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/60"
            />
          </div>
          <label className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg cursor-pointer hover:border-zinc-600">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
              className="accent-violet-500"
            />
            <span className="text-xs text-zinc-300">Publicada</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-3.5 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}
