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
  ListOrdered,
  ExternalLink,
  Youtube,
  ArrowLeft,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { slugify } from "./slug-utils";

interface FormState {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  youtubeUrl: string;
  order: number;
}

const EMPTY_FORM: FormState = {
  slug: "",
  title: "",
  summary: "",
  youtubeUrl: "",
  order: 0,
};

export function CategoryFeaturesEditor({ categoryId }: { categoryId: string }) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    ...orpc.spaceHelp.adminGetCategory.queryOptions({ input: { id: categoryId } }),
  });

  const upsertMut = useMutation({
    ...orpc.spaceHelp.upsertFeature.mutationOptions(),
    onSuccess: () => {
      toast.success(form.id ? "Funcionalidade atualizada" : "Funcionalidade criada");
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminGetCategory.key() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminListCategories.key() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminStats.key() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.listCategories.key() });
      closeForm();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const deleteMut = useMutation({
    ...orpc.spaceHelp.deleteFeature.mutationOptions(),
    onSuccess: () => {
      toast.success("Funcionalidade removida");
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminGetCategory.key() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminListCategories.key() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminStats.key() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.listCategories.key() });
      setDeletingId(null);
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Erro ao remover");
      setDeletingId(null);
    },
  });

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, order: data?.category.features.length ?? 0 });
    setFormOpen(true);
  };

  const openEdit = (f: any) => {
    setForm({
      id: f.id,
      slug: f.slug,
      title: f.title,
      summary: f.summary ?? "",
      youtubeUrl: f.youtubeUrl ?? "",
      order: f.order,
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
      categoryId,
      slug,
      title: form.title.trim(),
      summary: form.summary.trim() || null,
      youtubeUrl: form.youtubeUrl.trim() || null,
      order: form.order,
    });
  };

  const handleDelete = (id: string, title: string, stepCount: number) => {
    const msg =
      stepCount > 0
        ? `A funcionalidade "${title}" tem ${stepCount} passo(s). Remover apaga tudo. Continuar?`
        : `Remover "${title}"?`;
    if (!confirm(msg)) return;
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

  const cat = data.category;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/space-help/categorias"
            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">{cat.name}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-mono">{cat.slug}</span>
              {" · "}
              {cat.features.length} funcionalidade(s)
            </p>
          </div>
        </div>
        <Link
          href={`/space-help/${cat.slug}`}
          target="_blank"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-info border border-border hover:border-info/30 px-3 py-2 rounded-lg transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Ver na plataforma
        </Link>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Funcionalidades (subtópicos)</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cada funcionalidade vira um artigo com vídeo + passos.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-3.5 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Nova funcionalidade
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card border-b border-border">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Ordem</th>
                <th className="px-4 py-3 font-medium">Título</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium text-center">Passos</th>
                <th className="px-4 py-3 font-medium text-center">Vídeo</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cat.features.map((f: any) => (
                <tr key={f.id} className="hover:bg-muted transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{f.order}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/space-help/funcionalidades/${f.id}`}
                      className="text-foreground font-medium hover:text-info"
                    >
                      {f.title}
                    </Link>
                    {f.summary && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{f.summary}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{f.slug}</td>
                  <td className="px-4 py-3 text-center text-foreground">{f._count.steps}</td>
                  <td className="px-4 py-3 text-center">
                    {f.youtubeUrl ? (
                      <Youtube className="w-4 h-4 text-destructive mx-auto" />
                    ) : (
                      <span className="text-[11px] text-muted-foreground/70">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/space-help/${cat.slug}/${f.slug}`}
                        target="_blank"
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                        title="Ver na plataforma"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => openEdit(f)}
                        className="p-1.5 text-muted-foreground hover:text-info hover:bg-muted rounded transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <Link
                        href={`/admin/space-help/funcionalidades/${f.id}`}
                        className="p-1.5 text-muted-foreground hover:text-info hover:bg-muted rounded transition-colors"
                        title="Editar passos"
                      >
                        <ListOrdered className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(f.id, f.title, f._count.steps)}
                        disabled={deletingId === f.id}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted rounded transition-colors disabled:opacity-50"
                        title="Remover"
                      >
                        {deletingId === f.id ? (
                          <OrbitaSpinner className="w-4 h-4 " />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {cat.features.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Nenhuma funcionalidade cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <FormDialog
          title={form.id ? "Editar funcionalidade" : "Nova funcionalidade"}
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
        className="bg-card border border-border rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-base font-semibold text-foreground">{title}</h3>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Título *</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Como criar uma tag"
            className="w-full bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Slug (URL)</label>
          <input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder={slugify(form.title) || "criar-tag"}
            className="w-full bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30 font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Resumo</label>
          <textarea
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            placeholder="Descrição curta exibida abaixo do título"
            rows={2}
            className="w-full bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30 resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">URL YouTube/Vimeo</label>
          <input
            value={form.youtubeUrl}
            onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30"
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
