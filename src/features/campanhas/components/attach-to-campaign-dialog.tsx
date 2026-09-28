"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBroadcasts } from "../hooks/use-broadcasts";
import { useAddRecipientsFromContacts } from "../hooks/use-contacts";
import { isBroadcastEditable } from "../lib/broadcast-status";
import type { AddRecipientsFromContactsInput } from "../schema/broadcast-schemas";

interface AttachToCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  /** Monta o input a partir da campanha escolhida (leadIds OU allMatching). */
  buildInput: (broadcastId: string) => AddRecipientsFromContactsInput;
  onDone: () => void;
}

export function AttachToCampaignDialog({
  open,
  onOpenChange,
  count,
  buildInput,
  onDone,
}: AttachToCampaignDialogProps) {
  const router = useRouter();
  const { data: broadcasts } = useBroadcasts();
  const addRecipients = useAddRecipientsFromContacts();
  const [broadcastId, setBroadcastId] = useState<string>();

  // Rascunhos + campanhas que falharam (reabrem ao receber destinatários).
  const targets = (broadcasts ?? []).filter((broadcast) =>
    isBroadcastEditable(broadcast.status),
  );

  function handleConfirm() {
    if (!broadcastId) return;
    addRecipients.mutate(buildInput(broadcastId), {
      onSuccess: (result) => {
        toast.success(
          `${result.added} contato(s) atrelado(s). Total na campanha: ${result.totalRecipients}.`,
        );
        onDone();
        onOpenChange(false);
        router.push(`/campanhas/${result.broadcastId}`);
      },
      onError: (error) =>
        toast.error(error.message ?? "Falha ao atrelar contatos."),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atrelar a uma campanha</DialogTitle>
          <DialogDescription>
            {count > 0
              ? `${count} contato(s) serão adicionados como destinatários da campanha escolhida.`
              : "Escolha a campanha que vai receber os contatos filtrados."}
          </DialogDescription>
        </DialogHeader>

        {targets.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma campanha em rascunho. Crie uma primeiro em{" "}
            <Link
              href="/campanhas"
              className="font-medium text-foreground underline"
            >
              Campanhas
            </Link>
            .
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Campanha</label>
            <Select value={broadcastId} onValueChange={setBroadcastId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma campanha" />
              </SelectTrigger>
              <SelectContent>
                {targets.map((broadcast) => (
                  <SelectItem key={broadcast.id} value={broadcast.id}>
                    {broadcast.name} · {broadcast.tracking.name}
                    {broadcast.status === "FAILED" ? " · (falhou — reabre)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Telefones são normalizados e duplicados ignorados automaticamente.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!broadcastId || addRecipients.isPending}
          >
            {addRecipients.isPending ? "Atrelando..." : "Atrelar e abrir campanha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
