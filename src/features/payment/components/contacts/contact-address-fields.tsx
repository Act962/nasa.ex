"use client";

import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLookupPaymentContactCep } from "../../hooks/use-payment";

// Endereço de cobrança do contato (spec 0133, D-7): o boleto exige. O CEP preenche o resto.

export interface ContactAddress {
  addressZipCode: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
}

export const EMPTY_CONTACT_ADDRESS: ContactAddress = {
  addressZipCode: "",
  addressStreet: "",
  addressNumber: "",
  addressComplement: "",
  addressNeighborhood: "",
  addressCity: "",
  addressState: "",
};

export function toContactAddress(contact: Partial<Record<keyof ContactAddress, string | null>>): ContactAddress {
  return {
    addressZipCode: maskZipCode(contact.addressZipCode ?? ""),
    addressStreet: contact.addressStreet ?? "",
    addressNumber: contact.addressNumber ?? "",
    addressComplement: contact.addressComplement ?? "",
    addressNeighborhood: contact.addressNeighborhood ?? "",
    addressCity: contact.addressCity ?? "",
    addressState: contact.addressState ?? "",
  };
}

/** Campos vazios viram `null`, para o servidor limpar o que foi apagado. */
export function toContactAddressInput(address: ContactAddress): Record<keyof ContactAddress, string | null> {
  return {
    addressZipCode: address.addressZipCode.replace(/\D/g, "") || null,
    addressStreet: address.addressStreet.trim() || null,
    addressNumber: address.addressNumber.trim() || null,
    addressComplement: address.addressComplement.trim() || null,
    addressNeighborhood: address.addressNeighborhood.trim() || null,
    addressCity: address.addressCity.trim() || null,
    addressState: address.addressState.trim().toUpperCase() || null,
  };
}

function maskZipCode(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

interface ContactAddressFieldsProps {
  address: ContactAddress;
  onChange: (address: ContactAddress) => void;
}

export function ContactAddressFields({ address, onChange }: ContactAddressFieldsProps) {
  const lookupCep = useLookupPaymentContactCep();

  function setField(field: keyof ContactAddress, value: string) {
    onChange({ ...address, [field]: value });
  }

  function handleZipCodeChange(value: string) {
    const masked = maskZipCode(value);
    const nextAddress = { ...address, addressZipCode: masked };
    onChange(nextAddress);
    if (masked.replace(/\D/g, "").length !== 8) return;
    lookupCep.mutate(
      { cep: masked },
      {
        onSuccess: ({ address: found }) => {
          if (!found) return;
          onChange({
            ...nextAddress,
            addressStreet: found.street || nextAddress.addressStreet,
            addressNeighborhood: found.neighborhood || nextAddress.addressNeighborhood,
            addressCity: found.city || nextAddress.addressCity,
            addressState: found.state || nextAddress.addressState,
          });
        },
      },
    );
  }

  return (
    <div className="grid grid-cols-6 gap-3">
      <div className="col-span-6 space-y-1.5 sm:col-span-2">
        <Label htmlFor="contact-zip-code">CEP</Label>
        <div className="relative">
          <Input
            id="contact-zip-code"
            inputMode="numeric"
            placeholder="00000-000"
            value={address.addressZipCode}
            onChange={(event) => handleZipCodeChange(event.target.value)}
          />
          {lookupCep.isPending && (
            <Loader2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>
      <div className="col-span-6 space-y-1.5 sm:col-span-4">
        <Label htmlFor="contact-street">Rua</Label>
        <Input
          id="contact-street"
          placeholder="Rua, avenida…"
          value={address.addressStreet}
          onChange={(event) => setField("addressStreet", event.target.value)}
        />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label htmlFor="contact-number">Número</Label>
        <Input
          id="contact-number"
          placeholder="123 ou S/N"
          value={address.addressNumber}
          onChange={(event) => setField("addressNumber", event.target.value)}
        />
      </div>
      <div className="col-span-4 space-y-1.5">
        <Label htmlFor="contact-complement">Complemento</Label>
        <Input
          id="contact-complement"
          placeholder="Sala, apto, bloco (opcional)"
          value={address.addressComplement}
          onChange={(event) => setField("addressComplement", event.target.value)}
        />
      </div>
      <div className="col-span-6 space-y-1.5 sm:col-span-3">
        <Label htmlFor="contact-neighborhood">Bairro</Label>
        <Input
          id="contact-neighborhood"
          placeholder="Centro"
          value={address.addressNeighborhood}
          onChange={(event) => setField("addressNeighborhood", event.target.value)}
        />
      </div>
      <div className="col-span-4 space-y-1.5 sm:col-span-2">
        <Label htmlFor="contact-city">Cidade</Label>
        <Input
          id="contact-city"
          placeholder="Teresina"
          value={address.addressCity}
          onChange={(event) => setField("addressCity", event.target.value)}
        />
      </div>
      <div className="col-span-2 space-y-1.5 sm:col-span-1">
        <Label htmlFor="contact-state">UF</Label>
        <Input
          id="contact-state"
          placeholder="PI"
          maxLength={2}
          value={address.addressState}
          onChange={(event) => setField("addressState", event.target.value.toUpperCase())}
        />
      </div>
    </div>
  );
}
