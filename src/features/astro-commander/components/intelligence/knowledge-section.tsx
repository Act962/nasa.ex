"use client";

import { useRef, useState } from "react";
import { BookOpen, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useAstroKnowledge,
  useAstroKnowledgeDocument,
  useDeleteAstroKnowledge,
  useSaveAstroKnowledge,
} from "@/features/astro-commander/hooks/use-astro-intelligence";

/**
 * Base de conhecimento (spec 0028, RF-13): documentos em Markdown que entram
 * inteiros no prompt do ASTRO — no chat, nos comandos e no site.
 */

function formatChars(chars: number): string {
  return chars >= 1000 ? `${(chars / 1000).toFixed(1).replace(".", ",")} mil caracteres` : `${chars} caracteres`;
}

export function KnowledgeSection() {
  const { documents, totalChars, limits, isLoading } = useAstroKnowledge();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteDocument = useDeleteAstroKnowledge();

  const isOverLimit = totalChars > limits.total;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <BookOpen className="size-4 text-muted-foreground" />
            Base de conhecimento
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            O que o ASTRO precisa saber sobre a empresa, escrito em texto. Vale no chat, nos
            comandos e no site.
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreating(true)}>
          <Plus className="size-4" />
          Novo documento
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : documents.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nada escrito ainda. Comece por um documento com o que a equipe mais repete: o que a
          empresa faz, preços, prazos e o que responder nas dúvidas de sempre.
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((document) => (
            <div
              key={document.id}
              className="flex items-center justify-between gap-3 rounded-xl border p-3"
            >
              <button
                type="button"
                onClick={() => setEditingId(document.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{document.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatChars(document.chars)}
                    {document.authorName ? ` · ${document.authorName}` : ""}
                  </span>
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Excluir ${document.name}`}
                onClick={() => setDeletingId(document.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <p className={`text-xs ${isOverLimit ? "text-amber-600" : "text-muted-foreground"}`}>
        {formatChars(totalChars)} de {formatChars(limits.total)} usados.
        {isOverLimit
          ? " Acima do limite, os documentos mais antigos deixam de entrar no prompt."
          : " Tudo isso é enviado ao ASTRO a cada conversa."}
      </p>

      {(isCreating || editingId) && (
        <KnowledgeEditor
          knowledgeId={editingId}
          maxChars={limits.perDocument}
          onClose={() => {
            setIsCreating(false);
            setEditingId(null);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deletingId}
        onCancel={() => setDeletingId(null)}
        isDangerous
        isLoading={deleteDocument.isPending}
        title="Excluir este documento?"
        description="O ASTRO deixa de usar este conteúdo nas respostas."
        confirmText="Excluir"
        onConfirm={() => {
          if (!deletingId) return;
          deleteDocument.mutate(
            { knowledgeId: deletingId },
            {
              onSuccess: () => {
                toast.success("Documento excluído");
                setDeletingId(null);
              },
              onError: (error) => toast.error(error.message),
            },
          );
        }}
      />
    </section>
  );
}

function KnowledgeEditor({
  knowledgeId,
  maxChars,
  onClose,
}: {
  knowledgeId: string | null;
  maxChars: number;
  onClose: () => void;
}) {
  const { document: loaded, isLoading } = useAstroKnowledgeDocument(knowledgeId);
  const saveDocument = useSaveAstroKnowledge();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<{ name: string; content: string } | null>(null);

  const values = draft ?? {
    name: loaded?.name ?? "",
    content: loaded?.content ?? "",
  };
  const patch = (changes: Partial<{ name: string; content: string }>) =>
    setDraft({ ...values, ...changes });

  const importFile = async (file: File) => {
    if (file.size > maxChars * 2) {
      toast.error("Arquivo muito grande para um documento só.");
      return;
    }
    const text = await file.text();
    patch({
      name: values.name || file.name.replace(/\.[^.]+$/, ""),
      content: text.slice(0, maxChars),
    });
  };

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{knowledgeId ? "Editar documento" : "Novo documento"}</DialogTitle>
          <DialogDescription>
            Escreva em texto corrido ou Markdown. Pode colar de um documento que já existe.
          </DialogDescription>
        </DialogHeader>

        {isLoading && knowledgeId ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="space-y-4">
            <Input
              value={values.name}
              maxLength={120}
              placeholder="Ex.: Produtos e preços"
              onChange={(event) => patch({ name: event.target.value })}
            />
            <Textarea
              value={values.content}
              rows={16}
              maxLength={maxChars}
              placeholder={"## Consultoria\nO que é, para quem serve, quanto custa.\n\n## Prazos\n…"}
              onChange={(event) => patch({ content: event.target.value })}
              className="font-mono text-xs"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {values.content.length} / {maxChars} caracteres
              </span>
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.markdown,.txt,text/plain,text/markdown"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void importFile(file);
                  }}
                />
                <button
                  type="button"
                  className="underline hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Importar de um arquivo .md ou .txt
                </button>
              </>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={values.name.trim().length < 2 || saveDocument.isPending}
            onClick={() =>
              saveDocument.mutate(
                {
                  knowledgeId: knowledgeId ?? undefined,
                  name: values.name.trim(),
                  content: values.content,
                },
                {
                  onSuccess: () => {
                    toast.success("Documento salvo. O ASTRO já usa no próximo pedido.");
                    onClose();
                  },
                  onError: (error) => toast.error(error.message),
                },
              )
            }
          >
            {saveDocument.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
