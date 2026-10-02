"use client";

import { ChevronDownIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
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
import { phoneMask } from "@/utils/format-phone";
import type { PhoneCountry } from "../../utils/profile-utils";

interface ProfilePhoneInputProps {
  selectedCountry: PhoneCountry;
  phone: string;
  isDisabled: boolean;
  onCountryChange: (country: PhoneCountry) => void;
  onPhoneChange: (maskedPhone: string) => void;
}

export function ProfilePhoneInput({
  selectedCountry,
  phone,
  isDisabled,
  onCountryChange,
  onPhoneChange,
}: ProfilePhoneInputProps) {
  return (
    <>
      <Label htmlFor="phone" className="sr-only">
        Telefone
      </Label>
      <InputGroup className="h-11 sm:h-9">
        <InputGroupAddon align="inline-start">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <InputGroupButton variant="ghost" className="text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedCountry.flag}
                  alt={selectedCountry.country}
                  className="h-4 w-5 rounded-full object-cover"
                />
                <span>{selectedCountry.ddi}</span>
                <ChevronDownIcon className="size-3" />
              </InputGroupButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-60 overflow-y-auto">
              <DropdownMenuGroup>
                {countries.map((country) => (
                  <DropdownMenuItem key={country.code} onClick={() => onCountryChange(country)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={country.flag}
                      alt={country.country}
                      className="h-4 w-5 rounded-full object-cover"
                    />
                    <span>{country.ddi}</span>
                    <span className="text-xs text-muted-foreground">{country.country}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </InputGroupAddon>
        <InputGroupInput
          id="phone"
          inputMode="tel"
          value={phone}
          onChange={(event) => onPhoneChange(phoneMask(event.target.value))}
          placeholder="(00) 0000-0000"
          className="pl-0"
          disabled={isDisabled}
        />
      </InputGroup>
    </>
  );
}
