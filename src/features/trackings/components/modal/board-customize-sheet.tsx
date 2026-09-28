"use client";

/**
 * Sheet "Personalizar board" — liga/desliga campos do card do lead e das
 * colunas por tracking, com preview ao vivo no board (via `visibilityPreview`
 * no kanban-store). Salvar persiste em `TrackingCardConfig.cardVisibility`;
 * fechar com alterações pendentes pede confirmação (salvar/descartar). O nome
 * do lead é sempre visível.
 *
 * O rascunho vive no próprio `visibilityPreview` do store (fonte única): os
 * Switches leem/escrevem nele e o board reflete ao vivo. Um `ref` de "semeado"
 * evita re-seed enquanto o Sheet está aberto.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useKanbanStore } from "../../lib/kanban-store";
import {
  CARD_FIELDS,
  CardFieldId,
  isFieldVisible,
} from "../../lib/card-visibility";
import {
  useCardConfig,
  useUpdateCardConfig,
} from "../../hooks/use-card-config";

interface Props {
  trackingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const cardFields = CARD_FIELDS.filter((field) => field.group === "card");
const columnFields = CARD_FIELDS.filter((field) => field.group === "column");

export function BoardCustomizeSheet({ trackingId, open, onOpenChange }: Props) {
  const { data: config } = useCardConfig(trackingId);
  const updateMutation = useUpdateCardConfig();

  const previewState = useKanbanStore((s) => s.visibilityPreview);
  const setVisibilityPreview = useKanbanStore((s) => s.setVisibilityPreview);
  const clearVisibilityPreview = useKanbanStore(
    (s) => s.clearVisibilityPreview,
  );

  const savedVisibility = config?.cardVisibility ?? null;
  // Rascunho só conta quando o preview no store é DESTE tracking.
  const draft =
    previewState?.trackingId === trackingId ? previewState.values : null;
  const isLoadingConfig = config === undefined;
  // Guarda o trackingId já semeado — re-semeia ao trocar de tracking, não
  // re-semeia num refetch do mesmo tracking (preserva edições em andamento).
  const seededForRef = useRef<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Há alterações pendentes? Compara campo a campo (robusto a ordem/ausência
  // de chaves) o rascunho vs. o config salvo.
  const isDirty = CARD_FIELDS.some(
    (field) =>
      isFieldVisible(draft, field.id) !==
      isFieldVisible(savedVisibility, field.id),
  );

  // Limpa o preview ao desmontar — evita rascunho órfão continuar aplicado ao
  // board (ex.: navegar para outro tracking com o Sheet aberto).
  useEffect(() => () => clearVisibilityPreview(), [clearVisibilityPreview]);

  // Semeia o preview a partir do config salvo quando o Sheet abre (esperando o
  // config carregar) e a cada troca de tracking; ao fechar, limpa. Só mexe no
  // store (sistema externo) e num ref — sem setState local.
  useEffect(() => {
    if (!open) {
      seededForRef.current = null;
      clearVisibilityPreview();
      return;
    }
    if (config === undefined || seededForRef.current === trackingId) return;
    seededForRef.current = trackingId;
    setVisibilityPreview(trackingId, savedVisibility ?? {});
  }, [
    open,
    config,
    trackingId,
    savedVisibility,
    setVisibilityPreview,
    clearVisibilityPreview,
  ]);

  const handleToggle = (id: CardFieldId, checked: boolean) => {
    // Marca como semeado pra um seed tardio não sobrescrever a interação.
    seededForRef.current = trackingId;
    setVisibilityPreview(trackingId, {
      ...(draft ?? savedVisibility ?? {}),
      [id]: checked,
    });
  };

  const handleSave = () => {
    updateMutation.mutate(
      {
        trackingId,
        fields: (config?.fields as never[]) ?? [],
        cardVisibility: draft ?? savedVisibility ?? {},
      },
      {
        onSuccess: () => {
          toast.success("Personalização salva");
          clearVisibilityPreview();
          setConfirmOpen(false);
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message ?? "Erro ao salvar"),
      },
    );
  };

  // Intercepta o fechamento (X, overlay, Esc, botão): com alterações pendentes,
  // abre o diálogo de confirmação em vez de descartar em silêncio.
  const requestOpenChange = (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (isDirty && !updateMutation.isPending) {
      setConfirmOpen(true);
      return;
    }
    onOpenChange(false);
  };

  const discardAndClose = () => {
    setConfirmOpen(false);
    clearVisibilityPreview();
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={requestOpenChange}>
        <SheetContent side="right" className="flex flex-col gap-0 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Personalizar board</SheetTitle>
            <SheetDescription>
              Escolha o que aparece nos cards e colunas. As mudanças aparecem no
              board em tempo real; clique em Salvar para aplicar a todos.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <Accordion
              type="multiple"
              defaultValue={["card", "column"]}
              className="w-full"
            >
              <AccordionItem value="card">
                <AccordionTrigger className="text-sm font-semibold text-muted-foreground">
                  Card do lead
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  {cardFields.map((field) => (
                    <FieldRow
                      key={field.id}
                      label={field.label}
                      checked={isFieldVisible(draft ?? savedVisibility, field.id)}
                      disabled={isLoadingConfig}
                      onCheckedChange={(checked) =>
                        handleToggle(field.id, checked)
                      }
                    />
                  ))}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="column">
                <AccordionTrigger className="text-sm font-semibold text-muted-foreground">
                  Colunas
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  {columnFields.map((field) => (
                    <FieldRow
                      key={field.id}
                      label={field.label}
                      checked={isFieldVisible(draft ?? savedVisibility, field.id)}
                      disabled={isLoadingConfig}
                      onCheckedChange={(checked) =>
                        handleToggle(field.id, checked)
                      }
                    />
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <SheetFooter className="border-t">
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending || isLoadingConfig || !isDirty}
            >
              {updateMutation.isPending && (
                <Loader2 className="size-4 animate-spin mr-2" />
              )}
              Salvar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salvar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Você personalizou os campos do board mas ainda não salvou. Deseja
              salvar as alterações ou descartá-las?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="ghost"
              onClick={discardAndClose}
              disabled={updateMutation.isPending}
            >
              Descartar
            </Button>
            <AlertDialogCancel disabled={updateMutation.isPending}>
              Continuar editando
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleSave();
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && (
                <Loader2 className="size-4 animate-spin mr-2" />
              )}
              Salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function FieldRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-0.5">
        <Label className="text-xs font-normal">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
