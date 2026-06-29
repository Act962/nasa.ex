"use client";

/**
 * DunningAssignDialog — modal pra atribuir/remover régua de cobrança a um
 * lançamento RECEIVABLE existente. Chama `dunning.entries.assignRule`, que
 * persiste o `dunningRuleId` e re-agenda eventos Inngest (idempotência via
 * dedup key + DB unique).
 */

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import {
  useDunningRules,
  useAssignDunningRuleToEntry,
} from "../../hooks/use-payment-dunning";

interface Props {
  entryId:        string | null;
  initialRuleId:  string | null;
  entryName?:     string;
  onClose:        () => void;
}

export function DunningAssignDialog({ entryId, initialRuleId, entryName, onClose }: Props) {
  const { data: rulesData, isLoading } = useDunningRules();
  const assignMut = useAssignDunningRuleToEntry();
  const [selectedRuleId, setSelectedRuleId] = useState<string>(initialRuleId ?? "__none__");

  function handleSave() {
    if (!entryId) return;
    assignMut.mutate(
      {
        entryId,
        dunningRuleId: selectedRuleId === "__none__" ? null : selectedRuleId,
      },
      {
        onSuccess: ({ scheduled }) => {
          toast.success(
            selectedRuleId === "__none__"
              ? "Régua removida do lançamento"
              : `Régua atribuída — ${scheduled} step${scheduled === 1 ? "" : "s"} agendado${scheduled === 1 ? "" : "s"}`,
          );
          onClose();
        },
        onError: (err) => toast.error(err.message ?? "Erro ao atribuir régua"),
      },
    );
  }

  const activeRules = (rulesData?.rules ?? []).filter((r) => r.isActive);

  return (
    <Dialog open={!!entryId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atribuir régua de cobrança</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {entryName && (
            <p className="text-xs text-muted-foreground">
              Lançamento: <span className="font-medium text-foreground">{entryName}</span>
            </p>
          )}
          <div className="space-y-2">
            <Label className="text-xs">Régua</Label>
            <Select value={selectedRuleId} onValueChange={setSelectedRuleId} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Carregando…" : "Selecionar"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem régua</SelectItem>
                {activeRules.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}{r.isDefault ? " (padrão)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeRules.length === 0 && !isLoading && (
              <p className="text-[11px] text-muted-foreground">
                Nenhuma régua ativa. Crie e ative em Settings → Régua de Cobrança.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Steps são agendados via Inngest no momento da atribuição (event-driven,
              sem cron). Mudanças na régua valem só pra novos eventos agendados.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={assignMut.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={assignMut.isPending}>
            {assignMut.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
