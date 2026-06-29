"use client";

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
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { countries } from "@/types/some";
import { phoneMask } from "@/utils/format-phone";
import { Button } from "@/components/ui/button";

interface FullPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>, value: string) => void;
}

export function FullPhoneInput({
  value,
  onChange,
  onKeyDown,
}: FullPhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);

  useEffect(() => {
    if (value) {
      const country = countries.find((country) =>
        value.startsWith(country.ddi),
      );
      if (country) {
        setSelectedCountry(country);
      }
    }
  }, [value]);
  return (
    <InputGroup>
      <InputGroupAddon align="inline-start">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <InputGroupButton variant="ghost" className="pr-1.5! text-xs">
              <img
                src={selectedCountry.flag}
                alt={selectedCountry.country}
                className="w-5 h-4 rounded-sm"
              />
              <span>{selectedCountry.ddi}</span>
              <ChevronDownIcon className="size-3" />
            </InputGroupButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="[--radius:0.95rem] max-h-30 overflow-y-auto"
          >
            <DropdownMenuGroup>
              {countries.map((country) => (
                <DropdownMenuItem
                  key={country.code}
                  onClick={() => setSelectedCountry(country)}
                >
                  <img
                    src={country.flag}
                    alt={country.country}
                    className="w-5 h-4 rounded-sm"
                  />
                  <span>{country.ddi}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </InputGroupAddon>
      <InputGroupInput
        id="phone"
        value={value}
        onChange={(e) => {
          onChange(phoneMask(e.target.value));
        }}
        onKeyDown={(e) => onKeyDown?.(e, selectedCountry.ddi + value)}
      />
      <InputGroupAddon align="inline-end">
        <Button variant="ghost" size="icon-xs">
          <CheckIcon className="size-3" />
        </Button>
      </InputGroupAddon>
    </InputGroup>
  );
}
