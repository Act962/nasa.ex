"use client";

import { useState } from "react";
import { Check, KeyRound, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  useMarkRecordPaid,
  useRecordPixSettings,
  useRecordPixStatus,
  useSaveRecordPixSettings,
  useSendRecordPix,
} from "@/features/form-records/hooks/use-record-pix";

// PIX das fichas (spec 0081, parte D): cadastro da chave, envio do copia e cola e baixa manual.

function formatShortDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

export function PixSettingsDialog({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (isOpen: boolean) => void }) {
  const { data: settings } = useRecordPixSettings(isOpen);
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receber por PIX</DialogTitle>
          <DialogDescription>Usada no &quot;copia e cola&quot; enviado ao cliente. É a mesma chave das Propostas.</DialogDescription>
        </DialogHeader>
        {/* O formulário só monta com os dados carregados: os campos nascem preenchidos, sem efeito de sincronização. */}
        {settings ? (
          <PixSettingsForm initialSettings={settings} onSaved={() => onOpenChange(false)} />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PixSettingsForm({
  initialSettings,
  onSaved,
}: {
  initialSettings: { pixKey: string; receiverName: string; receiverCity: string };
  onSaved: () => void;
}) {
  const saveSettings = useSaveRecordPixSettings();
  const [pixKey, setPixKey] = useState(initialSettings.pixKey);
  const [receiverName, setReceiverName] = useState(initialSettings.receiverName);
  const [receiverCity, setReceiverCity] = useState(initialSettings.receiverCity);
  const canSave = pixKey.trim().length >= 3 && receiverName.trim().length >= 2 && receiverCity.trim().length >= 2;

  const handleSave = () => {
    saveSettings.mutate(
      { pixKey, receiverName, receiverCity },
      {
        onSuccess: () => {
          toast.success("Chave PIX salva.");
          onSaved();
        },
        onError: (error) => toast.error(error.message || "Não foi possível salvar a chave PIX."),
      },
    );
  };

  return (
    <>
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-[13px] text-muted-foreground">Chave PIX</span>
          <Input value={pixKey} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" onChange={(event) => setPixKey(event.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-[13px] text-muted-foreground">Nome do recebedor</span>
          <Input value={receiverName} placeholder="Como aparece no banco" maxLength={60} onChange={(event) => setReceiverName(event.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-[13px] text-muted-foreground">Cidade</span>
          <Input value={receiverCity} placeholder="Ex.: Teresina" maxLength={40} onChange={(event) => setReceiverCity(event.target.value)} />
        </label>
      </div>
      <DialogFooter>
        <Button disabled={!canSave || saveSettings.isPending} onClick={handleSave}>
          Salvar
        </Button>
      </DialogFooter>
    </>
  );
}

/** Botão da barra das fichas que abre o cadastro da chave. */
export function PixSettingsButton() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" className="shrink-0 max-md:h-11" onClick={() => setIsOpen(true)}>
        <KeyRound className="size-4" />
        Chave PIX
      </Button>
      <PixSettingsDialog isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}

/** Ações de cobrança de uma ficha aberta. Não aparece em rascunho, ficha sem valor ou sem cliente. */
export function RecordPixActions({ responseId }: { responseId: string }) {
  const { data: pixStatus } = useRecordPixStatus(responseId);
  const sendPix = useSendRecordPix();
  const markPaid = useMarkRecordPaid();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  if (!pixStatus?.recordId || !pixStatus.isFinalized || !pixStatus.hasClient || pixStatus.usageTotalCents <= 0) return null;
  const recordId = pixStatus.recordId;
  const isPaid = Boolean(pixStatus.paidAt);

  const handleSend = () => {
    if (!pixStatus.hasPixKey) {
      setIsSettingsOpen(true);
      return;
    }
    sendPix.mutate(
      { recordId },
      {
        onSuccess: (result) => toast.success(`PIX enviado para ${result.leadName}.`),
        onError: (error) => toast.error(error.message || "Não foi possível enviar o PIX."),
      },
    );
  };

  const handleTogglePaid = () => {
    markPaid.mutate(
      { recordId, isPaid: !isPaid },
      {
        onSuccess: () => toast.success(isPaid ? "Baixa desfeita." : "Ficha marcada como paga."),
        onError: (error) => toast.error(error.message || "Não foi possível atualizar a ficha."),
      },
    );
  };

  return (
    <>
      {isPaid ? (
        <Badge variant="secondary">
          <Check className="size-3" />
          Paga em {formatShortDate(pixStatus.paidAt!)}
        </Badge>
      ) : (
        pixStatus.pixSentAt && <Badge variant="outline">PIX enviado em {formatShortDate(pixStatus.pixSentAt)}</Badge>
      )}
      {!isPaid && (
        <Button size="sm" disabled={sendPix.isPending} onClick={handleSend}>
          <QrCode className="size-4" />
          {pixStatus.hasPixKey ? (pixStatus.pixSentAt ? "Enviar PIX de novo" : "Enviar PIX") : "Cadastrar chave PIX"}
        </Button>
      )}
      <Button size="sm" variant="outline" disabled={markPaid.isPending} onClick={handleTogglePaid}>
        {isPaid ? "Desfazer baixa" : "Marcar como paga"}
      </Button>
      <PixSettingsDialog isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </>
  );
}
