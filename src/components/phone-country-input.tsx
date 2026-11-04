"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { countries } from "@/types/some";
import {
  detectBrowserPhoneCountry,
  maskLocalPhone,
  splitPhoneCountry,
  toDdiDigits,
  type PhoneCountry,
} from "@/utils/format-phone";

// Telefone com o código do país. `value` e `onChange` usam só dígitos com o código ("5586999538570").

interface PhoneCountryInputProps {
  value: string;
  onChange: (internationalDigits: string) => void;
  id?: string;
  disabled?: boolean;
}

export function PhoneCountryInput({ value, onChange, id, disabled }: PhoneCountryInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<PhoneCountry>(
    () => splitPhoneCountry(value, detectBrowserPhoneCountry()).country,
  );
  const valueDigits = value.replace(/\D/g, "");
  const selectedDdi = toDdiDigits(selectedCountry);
  const local = valueDigits.startsWith(selectedDdi) ? valueDigits.slice(selectedDdi.length) : valueDigits;
  const isBrazil = selectedCountry.code === "BR";

  function emit(country: PhoneCountry, localDigits: string) {
    const digits = maskLocalPhone(localDigits, country).replace(/\D/g, "");
    onChange(digits ? `${toDdiDigits(country)}${digits}` : "");
  }

  function selectCountry(country: PhoneCountry) {
    setSelectedCountry(country);
    emit(country, local);
  }

  return (
    <InputGroup>
      <InputGroupAddon align="inline-start">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <InputGroupButton variant="ghost" className="text-xs" disabled={disabled} aria-label="Código do país">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedCountry.flag} alt="" className="h-4 w-5 rounded-sm object-cover" />
              <span>{selectedCountry.ddi}</span>
              <ChevronDownIcon className="size-3" />
            </InputGroupButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
            <DropdownMenuGroup>
              {countries.map((country) => (
                <DropdownMenuItem key={country.code} onClick={() => selectCountry(country)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={country.flag} alt="" className="h-4 w-5 rounded-sm object-cover" />
                  <span>{country.ddi}</span>
                  <span className="text-xs text-muted-foreground">{country.country}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        inputMode="tel"
        value={maskLocalPhone(local, selectedCountry)}
        onChange={(event) => emit(selectedCountry, event.target.value)}
        placeholder={isBrazil ? "(00) 00000-0000" : "Número"}
        className="pl-0"
        disabled={disabled}
      />
    </InputGroup>
  );
}
