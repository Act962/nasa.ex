"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMPANY_DOCUMENT_TYPES,
  DOCUMENT_GROUP_LABELS,
  type DocumentGroup,
} from "@/features/accounting/lib/compliance/document-catalog";
import { CUSTOM_DOCUMENT_TYPE } from "./document-display";

const GROUPS = Object.keys(DOCUMENT_GROUP_LABELS) as DocumentGroup[];

interface DocumentTypeSelectProps {
  value: string;
  onValueChange: (typeCode: string) => void;
  id?: string;
}

export function DocumentTypeSelect({ value, onValueChange, id }: DocumentTypeSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Escolha o tipo de documento" />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {GROUPS.map((group) => {
          const groupTypes = COMPANY_DOCUMENT_TYPES.filter((documentType) => documentType.group === group);
          if (groupTypes.length === 0) return null;
          return (
            <SelectGroup key={group}>
              <SelectLabel>{DOCUMENT_GROUP_LABELS[group]}</SelectLabel>
              {groupTypes.map((documentType) => (
                <SelectItem key={documentType.code} value={documentType.code}>
                  {documentType.label}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
        <SelectSeparator />
        <SelectItem value={CUSTOM_DOCUMENT_TYPE}>Outro documento (avulso)</SelectItem>
      </SelectContent>
    </Select>
  );
}
