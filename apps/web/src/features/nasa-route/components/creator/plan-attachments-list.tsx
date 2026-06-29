"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  FileText,
  Link2,
  Plus,
  Trash2,
  Loader2,
  Upload,
  Save,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Attachment {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  url: string | null;
  fileKey: string | null;
  fileSize: number | null;
}

interface Plan {
  id: string;
  name: string;
  attachments: Attachment[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  courseId: string;
  plan: Plan;
}

type FormMode =
  | { kind: "closed" }
  | { kind: "new" }
  | { kind: "edit"; att: Attachment };

export function PlanAttachmentsList({ open, onClose, courseId, plan }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormMode>({ kind: "closed" });

  const removeAtt = useMutation({
    ...orpc.nasaRoute.creatorDeletePlanAttachment.mutationOptions(),
    onSuccess: () => {
      toast.success("Entrega removida");
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorListPlans.queryKey({ input: { courseId } }),
      });
    },
    onError: (err: any) => toast.error(err?.message ?? "Falha ao remover."),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Entregas do plano: {plan.name}</DialogTitle>
          <DialogDescription>
            Anexe PDFs (apostilas, materiais) ou links externos (Google Drive,
            Notion, etc.) que o aluno terá acesso ao comprar este plano.
          </DialogDescription>
        </DialogHeader>

        {plan.attachments.length === 0 && form.kind === "closed" ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <FileText className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Nenhuma entrega ainda</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Adicione PDFs ou links para enriquecer o pacote deste plano.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {plan.attachments.map((att) => (
              <li
                key={att.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div className="mt-0.5 flex size-8 flex-shrink-0 items-center justify-center rounded-md bg-muted">
                  {att.kind === "pdf" ? (
                    <FileText className="size-4" />
                  ) : (
                    <Link2 className="size-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{att.title}</p>
                  {att.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {att.description}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {att.kind === "pdf"
                      ? `PDF · ${formatSize(att.fileSize)}`
                      : "Link externo"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setForm({ kind: "edit", att })}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAtt.mutate({ id: att.id })}
                  disabled={removeAtt.isPending}
                >
                  <Trash2 className="size-4 text-rose-600" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {form.kind === "closed" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setForm({ kind: "new" })}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            Nova entrega
          </Button>
        ) : (
          <AttachmentForm
            courseId={courseId}
            plan={plan}
            initial={form.kind === "edit" ? form.att : undefined}
            onClose={() => setForm({ kind: "closed" })}
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FormProps {
  courseId: string;
  plan: Plan;
  initial?: Attachment;
  onClose: () => void;
}

function AttachmentForm({ courseId, plan, initial, onClose }: FormProps) {
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const [kind, setKind] = useState<"pdf" | "link">(
    (initial?.kind as "pdf" | "link" | undefined) ?? "pdf",
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [fileKey, setFileKey] = useState<string | null>(initial?.fileKey ?? null);
  const [fileSize, setFileSize] = useState<number | null>(
    initial?.fileSize ?? null,
  );
  const [uploading, setUploading] = useState(false);

  const upsert = useMutation({
    ...orpc.nasaRoute.creatorUpsertPlanAttachment.mutationOptions(),
    onSuccess: () => {
      toast.success(isEdit ? "Entrega atualizada!" : "Entrega adicionada!");
      qc.invalidateQueries({
        queryKey: orpc.nasaRoute.creatorListPlans.queryKey({ input: { courseId } }),
      });
      onClose();
    },
    onError: (err: any) => toast.error(err?.message ?? "Falha ao salvar."),
  });

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("PDF muito grande (máx. 10MB).");
      return;
    }
    setUploading(true);
    try {
      const presigned = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/pdf",
          size: file.size,
          isImage: false,
        }),
      });
      if (!presigned.ok) {
        const errData = await presigned.json().catch(() => ({}));
        const msg =
          presigned.status === 503
            ? "Armazenamento S3 não configurado."
            : errData?.error ?? "Falha ao gerar URL.";
        toast.error(msg);
        setUploading(false);
        return;
      }
      const { presignedUrl, key } = await presigned.json();
      const put = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });
      if (!put.ok) {
        toast.error("Falha no upload do PDF.");
        setUploading(false);
        return;
      }
      setFileKey(key);
      setFileSize(file.size);
      if (!title.trim()) setTitle(file.name.replace(/\.pdf$/i, ""));
      toast.success("PDF carregado!");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao subir o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Título é obrigatório.");
      return;
    }
    if (kind === "link" && !url.trim()) {
      toast.error("Cole a URL do link externo.");
      return;
    }
    if (kind === "pdf" && !fileKey) {
      toast.error("Faça upload de um arquivo PDF.");
      return;
    }
    upsert.mutate({
      id: initial?.id,
      planId: plan.id,
      kind,
      title: title.trim(),
      description: description.trim() || null,
      url: kind === "link" ? url.trim() : null,
      fileKey: kind === "pdf" ? fileKey : null,
      fileSize: kind === "pdf" ? fileSize : null,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          {isEdit ? "Editar entrega" : "Nova entrega"}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setKind("pdf")}
          className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${
            kind === "pdf"
              ? "border-violet-500 bg-violet-50 text-violet-900 dark:bg-violet-900/30 dark:text-violet-200"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="size-4" />
          Arquivo PDF
        </button>
        <button
          type="button"
          onClick={() => setKind("link")}
          className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition ${
            kind === "link"
              ? "border-violet-500 bg-violet-50 text-violet-900 dark:bg-violet-900/30 dark:text-violet-200"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <Link2 className="size-4" />
          Link externo
        </button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="att-title">Título *</Label>
        <Input
          id="att-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === "pdf" ? "Apostila do módulo 1" : "Comunidade no Discord"}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="att-desc">Descrição</Label>
        <Textarea
          id="att-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      {kind === "link" ? (
        <div className="space-y-2">
          <Label htmlFor="att-url">URL externa *</Label>
          <Input
            id="att-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://drive.google.com/…"
            required
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Arquivo PDF *</Label>
          {fileKey ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm">
              <FileText className="size-4 text-emerald-600" />
              <span className="flex-1 truncate">
                Arquivo carregado ({formatSize(fileSize)})
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFileKey(null);
                  setFileSize(null);
                }}
              >
                Trocar
              </Button>
            </div>
          ) : (
            <label
              htmlFor="att-file"
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card px-3 py-6 text-sm hover:border-primary ${uploading ? "opacity-60" : ""}`}
            >
              {uploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Enviando…
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  Clique para escolher um PDF (até 10MB)
                </>
              )}
              <input
                id="att-file"
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
              />
            </label>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={upsert.isPending || uploading}
          className="gap-1.5"
        >
          {upsert.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Salvar
        </Button>
      </div>
    </form>
  );
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
