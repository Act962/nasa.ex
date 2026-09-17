"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useAddTrafegoCopy,
  useRemoveTrafegoCopy,
  useSetTrafegoCopySelected,
  useUpdateTrafegoCopy,
} from "@/features/trafego/hooks/use-trafego-orders";
import { useSuggestTrafegoCopies } from "@/features/trafego/hooks/use-trafego-recommendations";
import { cn } from "@/lib/utils";
import { CopyComplianceBadge } from "./copy-compliance-badge";
import { TechnicalTerm } from "../technical-term";

interface Copy {
  id: string;
  headline: string | null;
  primaryText: string;
  description: string | null;
  callToAction: string | null;
  isSelected: boolean;
  source?: string;
  complianceLevel?: string | null;
  complianceIssues?: unknown;
}

interface CopiesManagerProps {
  orderId: string;
  copies: Copy[];
  maxCopies: number;
  readOnly: boolean;
}

const CTA_SUGGESTIONS = [
  "Saiba mais",
  "Enviar mensagem",
  "Comprar agora",
  "Cadastre-se",
  "Fale conosco",
];

interface CopyDraft {
  headline: string;
  primaryText: string;
  description: string;
  callToAction: string;
}

const EMPTY_DRAFT: CopyDraft = {
  headline: "",
  primaryText: "",
  description: "",
  callToAction: "",
};

function CopyEditorFields({
  draft,
  onChange,
}: {
  draft: CopyDraft;
  onChange: (draft: CopyDraft) => void;
}) {
  return (
    <div className="grid gap-3">
      <div>
        <Label className="text-xs">Título (opcional)</Label>
        <Input
          value={draft.headline}
          onChange={(event) =>
            onChange({ ...draft, headline: event.target.value })
          }
          placeholder="Ex.: Frete grátis nesta semana"
          className="mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">Texto principal</Label>
        <Textarea
          value={draft.primaryText}
          onChange={(event) =>
            onChange({ ...draft, primaryText: event.target.value })
          }
          placeholder="O que o seu cliente precisa ler para clicar?"
          rows={4}
          className="mt-1"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Descrição (opcional)</Label>
          <Input
            value={draft.description}
            onChange={(event) =>
              onChange({ ...draft, description: event.target.value })
            }
            placeholder="Linha de apoio"
            className="mt-1"
          />
        </div>
        <div>
          <div className="flex items-center text-xs">
            <Label className="text-xs">Botão (CTA)</Label>
            <TechnicalTerm term="cta" />
          </div>
          <Input
            value={draft.callToAction}
            onChange={(event) =>
              onChange({ ...draft, callToAction: event.target.value })
            }
            placeholder="Saiba mais"
            className="mt-1"
            list="trafego-cta-suggestions"
          />
          <datalist id="trafego-cta-suggestions">
            {CTA_SUGGESTIONS.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </div>
      </div>
    </div>
  );
}

export function CopiesManager({
  orderId,
  copies,
  maxCopies,
  readOnly,
}: CopiesManagerProps) {
  const [isComposing, setIsComposing] = useState(false);
  const [draft, setDraft] = useState<CopyDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CopyDraft>(EMPTY_DRAFT);

  const addCopy = useAddTrafegoCopy();
  const removeCopy = useRemoveTrafegoCopy(orderId);
  const setSelected = useSetTrafegoCopySelected(orderId);
  const updateCopy = useUpdateTrafegoCopy(orderId);
  const suggestCopies = useSuggestTrafegoCopies();

  const isFull = copies.length >= maxCopies;
  const selectedCount = copies.filter((copy) => copy.isSelected).length;

  function handleAdd() {
    if (draft.primaryText.trim().length === 0) {
      toast.error("Escreva o texto do anúncio.");
      return;
    }

    addCopy.mutate(
      {
        orderId,
        headline: draft.headline.trim() || undefined,
        primaryText: draft.primaryText.trim(),
        description: draft.description.trim() || undefined,
        callToAction: draft.callToAction.trim() || undefined,
      },
      {
        onSuccess: () => {
          setDraft(EMPTY_DRAFT);
          setIsComposing(false);
          toast.success("Copy adicionada.");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function startEditing(copy: Copy) {
    setIsComposing(false);
    setEditingId(copy.id);
    setEditDraft({
      headline: copy.headline ?? "",
      primaryText: copy.primaryText,
      description: copy.description ?? "",
      callToAction: copy.callToAction ?? "",
    });
  }

  function handleUpdate() {
    if (!editingId || editDraft.primaryText.trim().length === 0) {
      toast.error("Escreva o texto do anúncio.");
      return;
    }

    updateCopy.mutate(
      {
        copyId: editingId,
        headline: editDraft.headline.trim(),
        primaryText: editDraft.primaryText.trim(),
        description: editDraft.description.trim(),
        callToAction: editDraft.callToAction.trim(),
      },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditDraft(EMPTY_DRAFT);
          toast.success("Copy atualizada.");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">
            Copy do anúncio
            <TechnicalTerm term="copy" />
          </h3>
          <p className="text-xs text-muted-foreground">
            {copies.length} de {maxCopies} variações · {selectedCount}{" "}
            selecionada(s) para veicular
          </p>
        </div>

        {!readOnly && !isComposing && !editingId && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isFull || suggestCopies.isPending}
              onClick={() =>
                suggestCopies.mutate(
                  { orderId },
                  {
                    onSuccess: (created) =>
                      toast.success(
                        `${created.length} sugestões criadas. Revise antes de usar.`,
                      ),
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            >
              {suggestCopies.isPending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 size-4" />
              )}
              Sugerir com o Astro
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isFull}
              onClick={() => setIsComposing(true)}
            >
              <Plus className="mr-1.5 size-4" />
              Nova variação
            </Button>
          </div>
        )}
      </div>

      {isComposing && (
        <div className="mt-4 rounded-xl border bg-card p-4">
          <CopyEditorFields draft={draft} onChange={setDraft} />

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsComposing(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={addCopy.isPending}
            >
              {addCopy.isPending && (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              )}
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {copies.length === 0 && !isComposing ? (
        <div className="mt-4 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma copy ainda. Escreva o texto que vai aparecer no anúncio — você
          pode criar mais de uma variação e nossa equipe testa qual rende mais.
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {copies.map((copy) => (
            <div
              key={copy.id}
              className={cn(
                "rounded-xl border bg-card p-4 transition",
                copy.isSelected && "border-primary/50 bg-primary/[0.03]",
              )}
            >
              {editingId === copy.id ? (
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        Editar copy
                        <TechnicalTerm term="copy" />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        A prévia do anúncio será atualizada após salvar.
                      </p>
                    </div>
                  </div>
                  <CopyEditorFields draft={editDraft} onChange={setEditDraft} />
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(null)}
                      disabled={updateCopy.isPending}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleUpdate}
                      disabled={updateCopy.isPending}
                    >
                      {updateCopy.isPending && (
                        <Loader2 className="mr-1.5 size-4 animate-spin" />
                      )}
                      Salvar alterações
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {copy.headline && (
                      <p className="font-semibold leading-snug">
                        {copy.headline}
                      </p>
                    )}
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {copy.primaryText}
                    </p>
                    {copy.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {copy.description}
                      </p>
                    )}
                    {copy.callToAction && (
                      <span className="mt-2 inline-flex rounded-md bg-muted px-2 py-1 text-xs font-medium">
                        {copy.callToAction}
                      </span>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {copy.source === "SUGGESTED_BY_NASA" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                          <Sparkles className="size-3" />
                          Sugerida pelo Astro
                        </span>
                      )}
                      <CopyComplianceBadge
                        level={copy.complianceLevel ?? null}
                        issues={copy.complianceIssues}
                      />
                    </div>
                  </div>

                  {!readOnly && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEditing(copy)}
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        aria-label="Editar copy"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelected.mutate({
                            copyId: copy.id,
                            isSelected: !copy.isSelected,
                          })
                        }
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition",
                          copy.isSelected
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Check className="size-3" />
                        {copy.isSelected ? "Selecionada" : "Selecionar"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          removeCopy.mutate(
                            { copyId: copy.id },
                            { onError: (error) => toast.error(error.message) },
                          )
                        }
                        className="p-1 text-muted-foreground transition hover:text-destructive"
                        aria-label="Remover copy"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
