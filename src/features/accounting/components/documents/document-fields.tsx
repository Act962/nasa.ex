"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findDocumentType } from "@/features/accounting/lib/compliance/document-catalog";
import { TermLabel } from "../shared/fiscal-term-hint";
import { CUSTOM_DOCUMENT_TYPE } from "./document-display";
import { DocumentTypeSelect } from "./document-type-select";

export interface DocumentFieldValues {
  typeCode: string;
  label: string;
  period: string;
  issuedAt: string;
  expiresAt: string;
  number: string;
}

export const EMPTY_DOCUMENT_FIELDS: DocumentFieldValues = {
  typeCode: "",
  label: "",
  period: "",
  issuedAt: "",
  expiresAt: "",
  number: "",
};

export function isMonthlyDocumentType(typeCode: string): boolean {
  return findDocumentType(typeCode)?.recurrence === "MONTHLY";
}

interface DocumentFieldsProps {
  values: DocumentFieldValues;
  onChange: (values: DocumentFieldValues) => void;
  idPrefix: string;
}

/** Tipo, competência, datas e número — usados no envio e na revisão. */
export function DocumentFields({ values, onChange, idPrefix }: DocumentFieldsProps) {
  const documentType = findDocumentType(values.typeCode);
  const isMonthly = documentType?.recurrence === "MONTHLY";
  const hasValidity = !!documentType && documentType.defaultValidityDays !== null && !isMonthly;

  function updateField<FieldName extends keyof DocumentFieldValues>(fieldName: FieldName, fieldValue: string) {
    onChange({ ...values, [fieldName]: fieldValue });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-type`}>Que documento é este?</Label>
        <DocumentTypeSelect id={`${idPrefix}-type`} value={values.typeCode} onValueChange={(typeCode) => updateField("typeCode", typeCode)} />
        {documentType && <p className="text-xs text-muted-foreground">{documentType.description}</p>}
      </div>

      {values.typeCode === CUSTOM_DOCUMENT_TYPE && (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-label`}>Nome do documento</Label>
          <Input
            id={`${idPrefix}-label`}
            value={values.label}
            maxLength={120}
            placeholder="Ex.: Laudo de vistoria do imóvel"
            onChange={(event) => updateField("label", event.target.value)}
          />
        </div>
      )}

      {isMonthly && (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-period`}>
            <TermLabel termId="competencia">Mês de referência</TermLabel>
          </Label>
          <Input
            id={`${idPrefix}-period`}
            type="month"
            value={values.period}
            onChange={(event) => updateField("period", event.target.value)}
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-issued`}>Emitido em</Label>
          <Input
            id={`${idPrefix}-issued`}
            type="date"
            value={values.issuedAt}
            onChange={(event) => updateField("issuedAt", event.target.value)}
          />
        </div>
        {!isMonthly && (
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-expires`}>Válido até</Label>
            <Input
              id={`${idPrefix}-expires`}
              type="date"
              value={values.expiresAt}
              onChange={(event) => updateField("expiresAt", event.target.value)}
            />
            {hasValidity && !values.expiresAt && (
              <p className="text-[11px] text-muted-foreground">
                Sem data, estimamos {documentType.defaultValidityDays} dias a partir da emissão.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-number`}>Número ou código de controle (opcional)</Label>
        <Input
          id={`${idPrefix}-number`}
          value={values.number}
          maxLength={120}
          onChange={(event) => updateField("number", event.target.value)}
        />
      </div>
    </div>
  );
}
