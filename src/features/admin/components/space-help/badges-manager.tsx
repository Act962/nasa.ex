"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Award,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { slugify } from "./slug-utils";

interface FormState {
  id?: string;
  slug: string;
  name: string;
  description: string;
  iconUrl: string;
  color: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  slug: "",
  name: "",
  description: "",
  iconUrl: "",
  color: "#a78bfa",
  isActive: true,
};

export function BadgesManager() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    ...orpc.spaceHelp.adminListBadges.queryOptions(),
  });

  const upsertMut = useMutation({
    ...orpc.spaceHelp.upsertBadge.mutationOptions(),
    onSuccess: () => {
      toast.success(form.id ? "Selo atualizado" : "Selo criado");
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminListBadges.queryKey() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminStats.queryKey() });
      closeForm();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const deleteMut = useMutation({
    ...orpc.spaceHelp.deleteBadge.mutationOptions(),
    onSuccess: () => {
      toast.success("Selo removido");
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminListBadges.queryKey() });
      qc.invalidateQueries({ queryKey: orpc.spaceHelp.adminStats.queryKey() });
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

  const openEdit = (b: any) => {
    setForm({
      id: b.id,
      slug: b.slug,
      name: b.name,
      description: b.description ?? "",
      iconUrl: b.iconUrl ?? "",
      color: b.color ?? "#a78bfa",
      isActive: b.isActive,
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
      iconUrl: form.iconUrl.trim() || null,
      color: form.color.trim() || null,
      isActive: form.isActive,
    });
  };

  const handleDelete = (id: string, name: string, trackCount: number, awardedCount: number) => {
    if (trackCount > 0) {
      toast.error(
        `O selo "${name}" está vinculado a ${trackCount} trilha(s). Remova o vínculo primeiro.`,
      );
      return;
    }
    const msg =
      awardedCount > 0
        ? `O selo "${name}" já foi conquistado por ${awardedCount} usuário(s). Remover apaga as conquistas. Continuar?`
        : `Remover "${name}"?`;
    if (!confirm(msg)) return;
    setDeletingId(id);
    deleteMut.mutate({ id });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Award className="w-5 h-5 text-warning" /> Selos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conquistas que os usuários ganham ao concluir trilhas.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-3.5 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo selo
        </button>
      </div>

      {isLoading ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          <OrbitaSpinner className="w-5 h-5 mx-auto mb-2" /> Carregando…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.badges.map((b: any) => (
            <div
              key={b.id}
              className="bg-card border border-border rounded-xl p-5 hover:border-muted-foreground/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                    style={{ background: `${b.color ?? "#a78bfa"}22`, border: `1px solid ${b.color ?? "#a78bfa"}44` }}
                  >
                    {b.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.iconUrl} alt={b.name} className="w-8 h-8 object-contain" />
                    ) : (
                      <Award className="w-6 h-6" style={{ color: b.color ?? "#a78bfa" }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground truncate">{b.name}</h3>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">{b.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(b)}
                    className="p-1.5 text-muted-foreground hover:text-info hover:bg-muted rounded transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(b.id, b.name, b._count.tracks, b._count.awarded)}
                    disabled={deletingId === b.id}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted rounded transition-colors disabled:opacity-50"
                    title="Remover"
                  >
                    {deletingId === b.id ? (
                      <OrbitaSpinner className="w-4 h-4 " />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {b.description && (
                <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{b.description}</p>
              )}

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>{b._count.tracks} trilha(s)</span>
                  <span>·</span>
                  <span>{b._count.awarded} concedido(s)</span>
                </div>
                {b.isActive ? (
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircle2 className="w-3 h-3" /> Ativo
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <XCircle className="w-3 h-3" /> Inativo
                  </span>
                )}
              </div>
            </div>
          ))}
          {data?.badges.length === 0 && (
            <div className="col-span-full bg-card border border-border rounded-xl p-12 text-center">
              <Award className="w-10 h-10 text-muted-foreground/70 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhum selo cadastrado. Crie o primeiro para premiar trilhas concluídas.
              </p>
            </div>
          )}
        </div>
      )}

      {formOpen && (
        <FormDialog
          title={form.id ? "Editar selo" : "Novo selo"}
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
          <label className="text-xs font-medium text-muted-foreground">Nome *</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Mestre do Tracking"
            className="w-full bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Slug (URL)</label>
          <input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder={slugify(form.name) || "mestre-tracking"}
            className="w-full bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30 font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Descrição</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Conquistado ao concluir todas as aulas da trilha de Tracking"
            rows={2}
            className="w-full bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30 resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">URL do ícone</label>
          <input
            value={form.iconUrl}
            onChange={(e) => setForm({ ...form, iconUrl: e.target.value })}
            placeholder="https://cdn.../icon.svg"
            className="w-full bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Cor (hex)</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="w-12 h-10 bg-muted border border-line rounded-lg cursor-pointer"
            />
            <input
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              placeholder="#a78bfa"
              className="flex-1 bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/30 font-mono"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            className="w-4 h-4 rounded bg-muted border-line text-info focus:ring-ring/30"
          />
          Selo ativo (pode ser concedido)
        </label>

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
