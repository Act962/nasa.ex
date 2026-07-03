"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { ChevronDownIcon } from "lucide-react";
import { countries } from "@/types/some";

type LeadStepProps = {
  showName: boolean;
  showEmail: boolean;
  showPhone: boolean;
  leadInfo: { name: string; email: string; phone: string };
  selectedCountry: (typeof countries)[number];
  formErrors: Record<string, string>;
  resumeLoading: boolean;
  textColor?: string;
  primaryBtnStyle: React.CSSProperties;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (rawValue: string) => void;
  onCountryChange: (country: (typeof countries)[number]) => void;
  onContinue: () => void;
};

export function LeadStep({
  showName,
  showEmail,
  showPhone,
  leadInfo,
  selectedCountry,
  formErrors,
  resumeLoading,
  textColor,
  primaryBtnStyle,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onCountryChange,
  onContinue,
}: LeadStepProps) {
  return (
    <>
      <Card
        className="w-full border-none px-4 bg-transparent"
        style={{ color: textColor || undefined }}
      >
        <CardContent className="p-0 flex flex-col gap-4">
          <h2 className="text-3xl font-semibold mb-4">
            Preencha os campos abaixo
          </h2>

          {showName && (
            <Field>
              <FieldLabel htmlFor="lead_name">Nome completo</FieldLabel>
              <Input
                id="lead_name"
                placeholder="Seu nome"
                style={{ color: textColor || undefined }}
                value={leadInfo.name}
                onChange={(e) => onNameChange(e.target.value)}
              />
              {formErrors["lead_name"] && (
                <FieldError>{formErrors["lead_name"]}</FieldError>
              )}
            </Field>
          )}

          {showEmail && (
            <Field>
              <FieldLabel htmlFor="lead_email">E-mail</FieldLabel>
              <Input
                id="lead_email"
                placeholder="seu@email.com"
                type="email"
                style={{ color: textColor || undefined }}
                value={leadInfo.email}
                onChange={(e) => onEmailChange(e.target.value)}
              />
              {formErrors["lead_email"] && (
                <FieldError>{formErrors["lead_email"]}</FieldError>
              )}
            </Field>
          )}

          {showPhone && (
            <Field>
              <FieldLabel htmlFor="lead_phone">Telefone</FieldLabel>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <InputGroupButton
                        variant="ghost"
                        className="text-xs gap-1 px-2"
                        style={{ color: textColor || undefined }}
                      >
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
                      align="start"
                      className="max-h-60 overflow-y-auto"
                    >
                      <DropdownMenuGroup>
                        {countries.map((country) => (
                          <DropdownMenuItem
                            key={country.code}
                            onClick={() => onCountryChange(country)}
                          >
                            <img
                              src={country.flag}
                              alt={country.country}
                              className="w-5 h-4 rounded-sm"
                            />
                            <span className="ml-2">{country.ddi}</span>
                            <span className="ml-1 text-muted-foreground text-xs">
                              {country.country}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </InputGroupAddon>

                <InputGroupInput
                  id="lead_phone"
                  placeholder="(00) 00000-0000"
                  className="pl-0"
                  style={{ color: textColor || undefined }}
                  value={leadInfo.phone}
                  onChange={(e) => onPhoneChange(e.target.value)}
                />
              </InputGroup>
              {formErrors["lead_phone"] && (
                <FieldError>{formErrors["lead_phone"]}</FieldError>
              )}
            </Field>
          )}
        </CardContent>
      </Card>

      <Button
        className="w-full max-w-[80%] mx-auto"
        style={primaryBtnStyle}
        disabled={resumeLoading}
        onClick={onContinue}
      >
        {resumeLoading ? "Verificando..." : "Continuar"}
      </Button>
    </>
  );
}
