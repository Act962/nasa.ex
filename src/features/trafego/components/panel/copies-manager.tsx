"use client";

import { useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useAddTrafegoCopy,
  useRemoveTrafegoCopy,
  useSetTrafegoCopySelected,
} from "@/features/trafego/hooks/use-trafego-orders";
import { cn } from "@/lib/utils";

interface Copy {
  id: string;
  headline: string | null;
  primaryText: string;
  description: string | null;
  callToAction: string | null;
  isSelected: boolean;
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

export function CopiesManager({
  orderId,
  copies,
  maxCopies,
  readOnly,
}: CopiesManagerProps) {
  const [isComposing, setIsComposing] = useState(false);
  const [draft, setDraft] = useState({
    headline: "",
    primaryText: "",
    description: "",
    callToAction: "",
  });

  const addCopy = useAddTrafegoCopy();
  const removeCopy = useRemoveTrafegoCopy(orderId);
  const setSelected = useSetTrafegoCopySelected(orderId);

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
          setDraft({ headline: "", primaryText: "", description: "", callToAction: "" });
          setIsComposing(false);
          toast.success("Copy adicionada.");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Copy do anúncio</h3>
          <p className="text-xs text-muted-foreground">
            {copies.length} de {maxCopies} variações · {selectedCount} selecionada(s)
            para veicular
          </p>
        </div>

        {!readOnly && !isComposing && (
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
        )}
      </div>

      {isComposing && (
        <div className="mt-4 rounded-xl border bg-card p-4">
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">Título (opcional)</Label>
              <Input
                value={draft.headline}
                onChange={(event) => setDraft({ ...draft, headline: event.target.value })}
                placeholder="Ex.: Frete grátis nesta semana"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Texto principal</Label>
              <Textarea
                value={draft.primaryText}
                onChange={(event) =>
                  setDraft({ ...draft, primaryText: event.target.value })
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
                    setDraft({ ...draft, description: event.target.value })
                  }
                  placeholder="Linha de apoio"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Botão</Label>
                <Input
                  value={draft.callToAction}
                  onChange={(event) =>
                    setDraft({ ...draft, callToAction: event.target.value })
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
              {addCopy.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {copies.length === 0 && !isComposing ? (
        <div className="mt-4 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma copy ainda. Escreva o texto que vai aparecer no anúncio — você pode
          criar mais de uma variação e nossa equipe testa qual rende mais.
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
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {copy.headline && (
                    <p className="font-semibold leading-snug">{copy.headline}</p>
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
                </div>

                {!readOnly && (
                  <div className="flex shrink-0 items-center gap-1">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
