"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useConfirmCompanyDocument,
  useExtractCompanyDocument,
} from "@/features/accounting/hooks/use-accounting-documents";
import { findDocumentType } from "@/features/accounting/lib/compliance/document-catalog";
import type { StoredCompanyDocumentExtraction } from "@/features/accounting/schemas/company-document-extraction";
import { CUSTOM_DOCUMENT_TYPE } from "./document-display";
import { DocumentFields, isMonthlyDocumentType, type DocumentFieldValues } from "./document-fields";

interface DocumentReviewFormProps {
  documentId: string;
  initialValues: DocumentFieldValues;
  /** Lê com IA ao abrir (logo após o envio, ou quando a leitura já está em cache). */
  shouldAutoExtract: boolean;
  onDone: () => void;
}

function applyExtraction(values: DocumentFieldValues, extraction: StoredCompanyDocumentExtraction): DocumentFieldValues {
  return {
    ...values,
    typeCode: extraction.suggestedTypeCode ?? values.typeCode,
    number: extraction.number ?? values.number,
    issuedAt: extraction.issuedAt ?? values.issuedAt,
    expiresAt: extraction.expiresAt ?? values.expiresAt,
  };
}

function formatCnpj(digits: string): string {
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function DocumentReviewForm({ documentId, initialValues, shouldAutoExtract, onDone }: DocumentReviewFormProps) {
  const [values, setValues] = useState(initialValues);
  const [extraction, setExtraction] = useState<StoredCompanyDocumentExtraction | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const extractDocument = useExtractCompanyDocument();
  const confirmDocument = useConfirmCompanyDocument();
  const hasRequestedExtraction = useRef(false);

  function runExtraction() {
    setExtractionError(null);
    extractDocument.mutate(
      { documentId },
      {
        onSuccess: (result) => {
          setExtraction(result.extraction);
          setValues((currentValues) => applyExtraction(currentValues, result.extraction));
        },
        onError: (error) => setExtractionError(error.message || "Não foi possível ler o documento."),
      },
    );
  }

  useEffect(() => {
    if (!shouldAutoExtract || hasRequestedExtraction.current) return;
    hasRequestedExtraction.current = true;
    runExtraction();
    // Roda uma vez por documento aberto; `runExtraction` muda a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, shouldAutoExtract]);

  const isMonthly = isMonthlyDocumentType(values.typeCode);
  const isCustomWithoutLabel = values.typeCode === CUSTOM_DOCUMENT_TYPE && !values.label.trim();
  const canConfirm = !!values.typeCode && !isCustomWithoutLabel && (!isMonthly || !!values.period) && !confirmDocument.isPending;
  const suggestedType = extraction?.suggestedTypeCode ? findDocumentType(extraction.suggestedTypeCode) : null;

  function confirm() {
    confirmDocument.mutate(
      {
        documentId,
        typeCode: values.typeCode,
        label: values.label || null,
        number: values.number || null,
        issuedAt: values.issuedAt || null,
        expiresAt: isMonthly ? null : values.expiresAt || null,
        period: isMonthly ? values.period || null : null,
      },
      {
        onSuccess: () => {
          toast.success("Documento confirmado — o score já foi atualizado.");
          onDone();
        },
        onError: (error) => toast.error(error.message || "Não foi possível confirmar."),
      },
    );
  }

  return (
    <div className="space-y-4">
      {extractDocument.isPending && (
        <div className="flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 text-sm">
          <Loader2 className="size-4 animate-spin text-violet-500" /> Lendo o documento com IA…
        </div>
      )}

      {extractionError && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-300">A IA não conseguiu ler este arquivo</p>
          <p className="text-muted-foreground">{extractionError} Preencha os dados abaixo à mão.</p>
        </div>
      )}

      {!extraction && !extractDocument.isPending && !shouldAutoExtract && (
        <Button type="button" variant="outline" size="sm" onClick={runExtraction}>
          <Sparkles className="size-3.5" /> Ler com IA
        </Button>
      )}

      {extraction && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="size-4 text-violet-500" /> O que a IA leu
            <span className="text-xs font-normal text-muted-foreground">
              (confiança {Math.round(extraction.confidence * 100)}%)
            </span>
          </p>
          <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Tipo</dt>
              <dd>{suggestedType?.label ?? "Não identificado"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Titular</dt>
              <dd>{extraction.holderName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">CNPJ</dt>
              <dd>{extraction.cnpj ? formatCnpj(extraction.cnpj) : "—"}</dd>
            </div>
            {extraction.isNegative !== null && (
              <div>
                <dt className="text-muted-foreground">Resultado da certidão</dt>
                <dd className={cn(extraction.isNegative ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                  {extraction.isNegative ? "Negativa (empresa regular)" : "Positiva (há débitos)"}
                </dd>
              </div>
            )}
          </dl>
          {extraction.cnpjMismatch && (
            <p className="flex gap-1.5 rounded-md bg-red-500/10 px-2 py-1.5 text-xs font-medium text-red-700 dark:text-red-300">
              <AlertTriangle className="size-3.5 shrink-0" />
              O CNPJ do documento é diferente do CNPJ cadastrado da empresa. Confira se é o arquivo certo.
            </p>
          )}
          {extraction.warnings.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-amber-700 dark:text-amber-300">
              {extraction.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">Confira e corrija abaixo antes de confirmar.</p>
        </div>
      )}

      <DocumentFields values={values} onChange={setValues} idPrefix={`review-${documentId}`} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDone}>
          Revisar depois
        </Button>
        <Button
          type="button"
          className="bg-violet-600 text-white hover:bg-violet-700"
          disabled={!canConfirm || extractDocument.isPending}
          onClick={confirm}
        >
          {confirmDocument.isPending && <Loader2 className="size-3.5 animate-spin" />}
          Confirmar documento
        </Button>
      </div>
    </div>
  );
}
