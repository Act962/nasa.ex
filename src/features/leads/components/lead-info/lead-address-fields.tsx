"use client";

import { FieldText } from "./fields/field-text";

// Aba "Endereço" do lead (spec 0034) — a mesma na página do contato e na
// lateral do chat. Cada campo salva sozinho, como os de Informações.

export interface LeadAddress {
  addressZipCode?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressCountry?: string | null;
}

const ADDRESS_FIELDS: { key: keyof LeadAddress; label: string; placeholder?: string }[] = [
  { key: "addressZipCode", label: "CEP" },
  { key: "addressStreet", label: "Logradouro" },
  { key: "addressNumber", label: "Número" },
  { key: "addressComplement", label: "Complemento" },
  { key: "addressNeighborhood", label: "Bairro" },
  { key: "addressCity", label: "Cidade" },
  { key: "addressState", label: "Estado" },
  { key: "addressCountry", label: "País", placeholder: "Brasil" },
];

interface LeadAddressFieldsProps {
  address: LeadAddress;
  trackingId: string;
  leadId?: string;
}

export function LeadAddressFields({ address, trackingId, leadId }: LeadAddressFieldsProps) {
  return (
    <>
      {ADDRESS_FIELDS.map((field) => (
        <FieldText
          key={field.key}
          label={field.label}
          value={address[field.key] ?? ""}
          fieldKey={field.key}
          placeholder={field.placeholder}
          trackingId={trackingId}
          leadId={leadId}
        />
      ))}
    </>
  );
}
