"use client";

import { useMemo, useState } from "react";
import {
  FileTextIcon,
  Loader2,
  PaperclipIcon,
  SendIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatCurrency,
  parseCurrencyToCents,
} from "@/features/payment/lib/format";
import { useExtractBudget } from "../../hooks/use-extract-budget";

interface BudgetCreateViewProps {
  conversationId: string;
  trackingId: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  whatsappToken: string;
  onSuccess: () => void;
  /**
   * Dados de pré-preenchimento — usados quando o painel é aberto a
   * partir da detecção de proposta em upload regular do chat (footer).
   */
  initialAttach?: {
    key: string;
    name: string;
    mime: string;
    valueCents: number | null;
    description: string;
    confidence: "high" | "medium" | "low";
  } | null;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const formatCentsForInput = (cents: number | null | undefined): string =>
  cents && cents > 0 ? (cents / 100).toFixed(2).replace(".", ",") : "";

/**
 * Tab "Orçamento Rápido" do painel mesclado "Propostas e Orçamentos".
 *
 * Permite o consultor mandar um valor + descrição (ou subir um PDF e
 * deixar a IA preencher) e cria uma `PaymentEntry` "A receber" pra
 * capturar métricas. Quando há arquivo anexado, envia como DOCUMENT
 * no WhatsApp (em vez do texto formatado).
 */
export function BudgetCreateView({
  conversationId,
  trackingId,
  leadId,
  leadName,
  leadPhone,
  whatsappToken,
  onSuccess,
  initialAttach,
}: BudgetCreateViewProps) {
  // ── Form state ───────────────────────────────────────────────────────
  const [valueStr, setValueStr] = useState(() =>
    formatCentsForInput(initialAttach?.valueCents ?? null),
  );
  const [description, setDescription] = useState(
    () => initialAttach?.description ?? "",
  );
  const [dueDays, setDueDays] = useState(7);

  // ── Anexo (PDF/imagem) ───────────────────────────────────────────────
  const [attachKey, setAttachKey] = useState<string | null>(
    initialAttach?.key ?? null,
  );
  const [attachName, setAttachName] = useState<string | null>(
    initialAttach?.name ?? null,
  );
  const [attachMime, setAttachMime] = useState<string | null>(
    initialAttach?.mime ?? null,
  );
  const [isUploading, setIsUploading] = useState(false);

  const [autoFilled, setAutoFilled] = useState<{
    value: boolean;
    description: boolean;
    confidence: "high" | "medium" | "low" | null;
  }>(() => ({
    value: !!initialAttach && initialAttach.valueCents !== null,
    description: !!initialAttach && !!initialAttach.description,
    confidence: initialAttach?.confidence ?? null,
  }));

  const extractMutation = useExtractBudget();
  const isExtracting = extractMutation.isPending;

  const cents = useMemo(() => parseCurrencyToCents(valueStr), [valueStr]);
  const formatted = useMemo(
    () => (cents > 0 ? formatCurrency(cents) : ""),
    [cents],
  );

  // ── Mutations ────────────────────────────────────────────────────────
  const sendMessage = useMutation(orpc.message.create.mutationOptions());
  const sendMessageWithFile = useMutation(
    orpc.message.createWithFile.mutationOptions(),
  );
  const createReceivable = useMutation(
    orpc.payment.entries.create.mutationOptions(),
  );

  const isPending =
    sendMessage.isPending ||
    sendMessageWithFile.isPending ||
    createReceivable.isPending ||
    isUploading ||
    isExtracting;

  // ── Upload + IA ──────────────────────────────────────────────────────
  const handleAttachFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }
    setIsUploading(true);
    setAttachName(file.name);
    setAttachMime(file.type || "application/octet-stream");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/s3/upload-direct", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Falha no upload");
      }
      const { key } = (await res.json()) as { key: string };
      setAttachKey(key);
      setIsUploading(false);

      extractMutation.mutate(
        { fileKey: key },
        {
          onSuccess: (data) => {
            const nextAuto = {
              value: false,
              description: false,
              confidence: data.confidence,
            };
            if (data.valueCents && data.valueCents > 0 && valueStr.trim() === "") {
              setValueStr((data.valueCents / 100).toFixed(2).replace(".", ","));
              nextAuto.value = true;
            }
            if (data.description && data.description.trim() && description.trim() === "") {
              setDescription(data.description.trim());
              nextAuto.description = true;
            }
            setAutoFilled(nextAuto);
            if (nextAuto.value || nextAuto.description) {
              toast.success(
                "Valor e descrição preenchidos pela IA. Confira antes de enviar.",
              );
            } else if (data.valueCents === null) {
              toast.info(
                "Não identifiquei valor neste arquivo. Preencha manualmente.",
              );
            }
          },
          onError: (err: any) => {
            toast.error(
              err?.message ??
                "Não consegui ler o arquivo com IA. Preencha manualmente.",
            );
          },
        },
      );
    } catch (err) {
      console.error("[budget-create-view] upload failed", err);
      toast.error((err as Error).message ?? "Falha ao enviar arquivo");
      setIsUploading(false);
      setAttachKey(null);
      setAttachName(null);
      setAttachMime(null);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachKey(null);
    setAttachName(null);
    setAttachMime(null);
    setAutoFilled({ value: false, description: false, confidence: null });
  };

  // ── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cents <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    if (!description.trim()) {
      toast.error("Descreva o que o orçamento cobre.");
      return;
    }
    const fullDesc = `Orçamento — ${leadName}: ${description.trim()}`;
    const dueDate = addDays(new Date(), dueDays).toISOString();

    try {
      if (attachKey) {
        await sendMessageWithFile.mutateAsync({
          conversationId,
          body: `💰 Orçamento: ${formatCurrency(cents)}\n${description.trim()}`,
          leadPhone,
          token: whatsappToken,
          mediaUrl: attachKey,
          fileName: attachName ?? "orcamento.pdf",
          mimetype: attachMime ?? "application/pdf",
        });
      } else {
        const messageBody = `💰 *Orçamento:* ${formatCurrency(cents)}\n${description.trim()}`;
        await sendMessage.mutateAsync({
          conversationId,
          body: messageBody,
          leadPhone,
          token: whatsappToken,
        });
      }
      await createReceivable.mutateAsync({
        type: "RECEIVABLE",
        description: fullDesc,
        amount: cents,
        dueDate,
        trackingId,
        leadId,
        ...(attachKey ? { attachmentUrl: attachKey } : {}),
      });
      toast.success(
        attachKey
          ? `Orçamento enviado com arquivo e lançado em "A receber" (${formatCurrency(cents)}).`
          : `Orçamento de ${formatCurrency(cents)} enviado e lançado em "A receber".`,
      );
      onSuccess();
    } catch (err) {
      toast.error(
        `Falhou ao enviar orçamento: ${(err as Error).message}`,
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
      {/* Upload de Orçamento — IA preenche valor + descrição */}
      <div className="space-y-1.5">
        <Label>Adicione o Orçamento aqui</Label>
        {!attachKey && !isUploading ? (
          <label
            htmlFor="budget-file"
            className="flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border text-xs text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5"
          >
            <PaperclipIcon className="size-4" />
            <span>
              Anexar PDF ou imagem (OS, orçamento, proposta) — a IA preenche os
              campos
            </span>
            <input
              id="budget-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAttachFile(f);
                e.target.value = "";
              }}
            />
          </label>
        ) : (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
            <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">
                {attachName ?? "Arquivo"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {isUploading
                  ? "Subindo arquivo..."
                  : isExtracting
                    ? "Lendo arquivo com IA..."
                    : "Pronto pra enviar"}
              </p>
            </div>
            {(isUploading || isExtracting) && (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            )}
            {!isUploading && !isExtracting && (
              <button
                type="button"
                onClick={handleRemoveAttachment}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Remover anexo"
              >
                <XIcon className="size-3.5" />
              </button>
            )}
          </div>
        )}
        {(autoFilled.value || autoFilled.description) && (
          <div className="flex items-start gap-1.5 rounded-md bg-purple-500/10 px-2 py-1.5 text-[11px] text-purple-700 dark:text-purple-300">
            <SparklesIcon className="mt-0.5 size-3 shrink-0" />
            <span>
              Campos preenchidos pela IA — confira e edite se necessário antes
              de enviar.
              {autoFilled.confidence === "low" && (
                <>
                  {" "}
                  <strong>Baixa confiança</strong> — confira o valor.
                </>
              )}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="budget-value">Valor (R$)*</Label>
        <Input
          id="budget-value"
          placeholder="1500,00"
          value={valueStr}
          onChange={(e) => {
            setValueStr(e.target.value);
            if (autoFilled.value) {
              setAutoFilled((p) => ({ ...p, value: false }));
            }
          }}
          autoFocus
          inputMode="decimal"
        />
        {formatted && (
          <p className="text-xs text-muted-foreground">
            Será lançado como <strong>{formatted}</strong>
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="budget-desc">Descrição*</Label>
        <Textarea
          id="budget-desc"
          placeholder="Ex: Pacote completo de consultoria mensal"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (autoFilled.description) {
              setAutoFilled((p) => ({ ...p, description: false }));
            }
          }}
          rows={3}
          maxLength={500}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="budget-due">Vencimento</Label>
        <div className="flex items-center gap-2">
          <Input
            id="budget-due"
            type="number"
            min={1}
            max={365}
            value={dueDays}
            onChange={(e) => setDueDays(Number(e.target.value) || 7)}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">
            dias a partir de hoje
          </span>
        </div>
      </div>

      {cents > 0 && description.trim() && (
        <div className="rounded-md border border-dashed p-3 text-xs">
          <p className="mb-1 font-semibold text-muted-foreground">
            {attachKey ? "Será enviado como documento:" : "Mensagem no chat:"}
          </p>
          {attachKey ? (
            <div className="space-y-1">
              <p className="flex items-center gap-1.5">
                <FileTextIcon className="size-3" />
                <span className="truncate">{attachName}</span>
              </p>
              <p className="whitespace-pre-wrap text-muted-foreground">
                Legenda: 💰 Orçamento {formatted} — {description.trim()}
              </p>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">
              💰 <strong>Orçamento:</strong> {formatted}
              <br />
              {description.trim()}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button
          type="submit"
          disabled={isPending || cents <= 0 || !description.trim()}
          className="gap-1.5"
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          <SendIcon className="size-3.5" />
          {attachKey ? "Enviar arquivo + lançar" : "Enviar orçamento"}
        </Button>
      </div>
    </form>
  );
}
