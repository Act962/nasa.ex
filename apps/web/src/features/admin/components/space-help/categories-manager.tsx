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
  ChevronRight,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { slugify } from "./slug-utils";

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  iconKey: string | null;
  appId: string | null;
  order: number;
  isPublished: boolean;
  _count: { features: number; tracks: number };
}

interface FormState {
  id?: string;
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  appId: string;
  order: number;
  isPublished: boolean;
}

const EMPTY_FORM: FormState = {
  slug: "",
  name: "",
  description: "",
  iconKey: "",
  appId: "",
  order: 0,
  isPublished: true,
};

export function CategoriesManager() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    ...orpc.spaceHelp.adminListCategories.queryOptions(),
  });

  const upsertMut = useMutation({
    ...orpc.spaceHelp.upsertCategory.mutationOptions(),
    onSuccess: () => {
      toast.success(form.id ? "Tópico atualizado" : "Tópico criado");
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminListCategories.queryKey() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminStats.queryKey() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.listCategories.queryKey() });
      closeForm();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const deleteMut = useMutation({
    ...orpc.spaceHelp.deleteCategory.mutationOptions(),
    onSuccess: () => {
      toast.success("Tópico removido");
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminListCategories.queryKey() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminStats.queryKey() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.listCategories.queryKey() });
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

  const openEdit = (row: CategoryRow) => {
    setForm({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description ?? "",
      iconKey: row.iconKey ?? "",
      appId: row.appId ?? "",
      order: row.order,
      isPublished: row.isPublished,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    const slug = form.slug.trim() || slugify(form.name);
    upsertMut.mutate({
      id: form.id,
      slug,
      name: form.name.trim(),
      description: form.description.trim() || null,
      iconKey: form.iconKey.trim() || null,
      appId: form.appId.trim() || null,
      order: form.order,
      isPublished: form.isPublished,
    });
  };

  const handleDelete = (id: string, name: string, count: number) => {
    if (count > 0) {
      if (
        !confirm(
          `O tópico "${name}" tem ${count} item(s) vinculado(s). Remover vai apagar tudo em cascata. Continuar?`,
        )
      )
        return;
    } else {
      if (!confirm(`Remover o tópico "${name}"?`)) return;
    }
    setDeletingId(id);
    deleteMut.mutate({ id });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Tópicos</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Categorias principais do Space Help (ex: Tracking, Forge, NasaChat).
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo tópico
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
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium text-center">Funcionalidades</th>
                <th className="px-4 py-3 font-medium text-center">Trilhas</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {data?.categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3 text-zinc-400">{cat.order}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/space-help/categorias/${cat.id}`}
                      className="text-white font-medium hover:text-violet-300"
                    >
                      {cat.name}
                    </Link>
                    {cat.description && (
                      <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">
                        {cat.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{cat.slug}</td>
                  <td className="px-4 py-3 text-center text-zinc-300">
                    {cat._count.features}
                  </td>
                  <td className="px-4 py-3 text-center text-zinc-300">
                    {cat._count.tracks}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {cat.isPublished ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        <Eye className="w-3 h-3" /> Publicado
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
                        href={`/space-help/${cat.slug}`}
                        target="_blank"
                        className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                        title="Ver na plataforma"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => openEdit(cat)}
                        className="p-1.5 text-zinc-500 hover:text-violet-300 hover:bg-zinc-800 rounded transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <Link
                        href={`/admin/space-help/categorias/${cat.id}`}
                        className="p-1.5 text-zinc-500 hover:text-violet-300 hover:bg-zinc-800 rounded transition-colors"
                        title="Gerenciar funcionalidades"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() =>
                          handleDelete(
                            cat.id,
                            cat.name,
                            cat._count.features + cat._count.tracks,
                          )
                        }
                        disabled={deletingId === cat.id}
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"
                        title="Remover"
                      >
                        {deletingId === cat.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.categories.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-500">
                    Nenhum tópico cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <FormDialog
          title={form.id ? "Editar tópico" : "Novo tópico"}
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
        className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg p-6 space-y-4"
      >
        <h3 className="text-base font-semibold text-white">{title}</h3>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400">Nome *</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Tracking de Leads"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400">Slug (URL)</label>
          <input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder={slugify(form.name) || "tracking"}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60 font-mono"
          />
          <p className="text-[11px] text-zinc-600">Gerado automaticamente a partir do nome se vazio.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400">Descrição</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Resumo curto que aparece abaixo do título"
            rows={2}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Ícone (chave)</label>
            <input
              value={form.iconKey}
              onChange={(e) => setForm({ ...form, iconKey: e.target.value })}
              placeholder="rocket"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">App ID</label>
            <input
              value={form.appId}
              onChange={(e) => setForm({ ...form, appId: e.target.value })}
              placeholder="tracking"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60"
            />
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
            <span className="text-xs text-zinc-300">Publicado</span>
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
