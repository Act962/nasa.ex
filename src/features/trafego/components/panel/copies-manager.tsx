"use client";

import { useState } from "react";
import { PenLine, Plus, Sparkles } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useAddTrafegoCopy,
  useRemoveTrafegoCopy,
  useSetTrafegoCopySelected,
  useUpdateTrafegoCopy,
} from "@/features/trafego/hooks/use-trafego-orders";
import { useSuggestTrafegoCopies } from "@/features/trafego/hooks/use-trafego-recommendations";
import { TechnicalTerm } from "../technical-term";
import { CopyCard, type TrafegoCopy } from "./copy-card";
import { CopyEditorDialog } from "./copy-editor-dialog";
import { EMPTY_DRAFT, type CopyDraft } from "./copy-editor-fields";

interface CopiesManagerProps {
  orderId: string;
  copies: TrafegoCopy[];
  maxCopies: number;
  readOnly: boolean;
}

/** `null` = editor fechado; `NEW_COPY_TARGET` = nova variação; id = editando uma existente. */
type EditorTarget = string | null;

const NEW_COPY_TARGET = "new";

export function CopiesManager({
  orderId,
  copies,
  maxCopies,
  readOnly,
}: CopiesManagerProps) {
  const [editorTarget, setEditorTarget] = useState<EditorTarget>(null);
  const [draft, setDraft] = useState<CopyDraft>(EMPTY_DRAFT);

  const addCopy = useAddTrafegoCopy();
  const removeCopy = useRemoveTrafegoCopy(orderId);
  const setSelected = useSetTrafegoCopySelected(orderId);
  const updateCopy = useUpdateTrafegoCopy(orderId);
  const suggestCopies = useSuggestTrafegoCopies();

  const isFull = copies.length >= maxCopies;
  const selectedCount = copies.filter((copy) => copy.isSelected).length;
  const isCreating = editorTarget === NEW_COPY_TARGET;

  function openNewCopy() {
    setDraft(EMPTY_DRAFT);
    setEditorTarget(NEW_COPY_TARGET);
  }

  function openEditCopy(copy: TrafegoCopy) {
    setDraft({
      headline: copy.headline ?? "",
      primaryText: copy.primaryText,
      description: copy.description ?? "",
      callToAction: copy.callToAction ?? "",
    });
    setEditorTarget(copy.id);
  }

  function closeEditor() {
    setEditorTarget(null);
    setDraft(EMPTY_DRAFT);
  }

  function handleSubmit() {
    if (draft.primaryText.trim().length === 0) {
      toast.error("Escreva o texto do anúncio.");
      return;
    }

    if (isCreating) {
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
            closeEditor();
            toast.success("Texto adicionado.");
          },
          onError: (error) => toast.error(error.message),
        },
      );
      return;
    }

    if (!editorTarget) return;
    updateCopy.mutate(
      {
        copyId: editorTarget,
        headline: draft.headline.trim(),
        primaryText: draft.primaryText.trim(),
        description: draft.description.trim(),
        callToAction: draft.callToAction.trim(),
      },
      {
        onSuccess: () => {
          closeEditor();
          toast.success("Texto atualizado.");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function handleSuggest() {
    suggestCopies.mutate(
      { orderId },
      {
        onSuccess: (created) =>
          toast.success(
            `${created.length} sugestões criadas. Revise antes de usar.`,
          ),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">
            Texto do anúncio
            <TechnicalTerm term="copy" />
          </h3>
          <p className="text-xs text-muted-foreground">
            {copies.length} de {maxCopies} variações ·{" "}
            {selectedCount === 1
              ? "1 vai no anúncio"
              : `${selectedCount} vão no anúncio`}
          </p>
        </div>

        {!readOnly && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full sm:h-9"
              disabled={isFull || suggestCopies.isPending}
              onClick={handleSuggest}
            >
              {suggestCopies.isPending ? (
                <OrbitaSpinner className="mr-1.5 size-4" />
              ) : (
                <Sparkles className="mr-1.5 size-4" />
              )}
              <span className="sm:hidden">Pedir ao Astro</span>
              <span className="max-sm:hidden">Sugerir com o Astro</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full sm:h-9"
              disabled={isFull}
              onClick={openNewCopy}
            >
              <Plus className="mr-1.5 size-4" />
              Nova variação
            </Button>
          </div>
        )}
      </div>

      {copies.length === 0 ? (
        <div className="mt-4 rounded-[22px] border border-dashed px-6 py-8 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
            <PenLine className="size-5 text-muted-foreground" />
          </div>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
            Nenhum texto ainda. Escreva o que vai aparecer no anúncio — você
            pode criar mais de uma variação e nossa equipe testa qual rende
            mais.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {copies.map((copy) => (
            <CopyCard
              key={copy.id}
              copy={copy}
              readOnly={readOnly}
              onEdit={() => openEditCopy(copy)}
              onToggleSelected={() =>
                setSelected.mutate({
                  copyId: copy.id,
                  isSelected: !copy.isSelected,
                })
              }
              onRemove={() =>
                removeCopy.mutate(
                  { copyId: copy.id },
                  { onError: (error) => toast.error(error.message) },
                )
              }
            />
          ))}
        </div>
      )}

      <CopyEditorDialog
        open={editorTarget !== null}
        onOpenChange={(isOpen) => !isOpen && closeEditor()}
        title={isCreating ? "Novo texto do anúncio" : "Editar texto do anúncio"}
        description={
          isCreating
            ? "Escreva o que a pessoa lê antes de clicar."
            : "A prévia do anúncio é atualizada depois de salvar."
        }
        submitLabel={isCreating ? "Adicionar" : "Salvar alterações"}
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={handleSubmit}
        isSubmitting={addCopy.isPending || updateCopy.isPending}
      />
    </div>
  );
}
