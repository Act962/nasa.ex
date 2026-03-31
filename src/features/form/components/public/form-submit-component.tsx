"use client";
import { useEffect, useRef, useState } from "react";
import { FieldValue, FormBlockInstance } from "@/features/form/types";
import { Button } from "@/components/ui/button";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import { toast } from "sonner";
import { useMutationSubmitResponse } from "../../hooks/use-form";
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
import { Spinner } from "@/components/ui/spinner";
import { FormSettings } from "@/generated/prisma/client";
import { getContrastColor } from "@/utils/get-contrast-color";
import { cn } from "@/lib/utils";
import { countries } from "@/types/some";
import { normalizePhone, phoneMask } from "@/utils/format-phone";

type FormSubmitProps = {
  id: string;
  blocks: FormBlockInstance[];
  settings?: FormSettings | null;
};

export function FormSubmitComponent({ id, blocks, settings }: FormSubmitProps) {
  const submitResponse = useMutationSubmitResponse();

  const formVals = useRef<{ [key: string]: FieldValue }>({});
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setSubmitted] = useState(false);

  // ─── Phone DDI ─────────────────────────────────────────────
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);

  // ─── Settings ──────────────────────────────────────────────
  const showName = settings?.showName ?? true;
  const showEmail = settings?.showEmail ?? true;
  const showPhone = settings?.showPhone ?? true;
  const needLogin = settings?.needLogin ?? true;
  const finishMessage = settings?.finishMessage ?? "Obrigado por seu cadastro!";
  const primaryColor = settings?.primaryColor ?? undefined;
  const backgroundColor = settings?.backgroundColor ?? undefined;
  const backgroundImage = settings?.backgroundImage ?? undefined;
  const redirectUrl = settings?.redirectUrl ?? undefined;
  const idPixel = settings?.idPixel ?? undefined;
  const idTagManager = settings?.idTagManager ?? undefined;

  const showLeadFields = needLogin && (showName || showEmail || showPhone);
  const [step, setStep] = useState(showLeadFields ? 1 : 2);
  const textColor = backgroundColor
    ? getContrastColor(backgroundColor)
    : undefined;

  // ─── Facebook Pixel ────────────────────────────────────────
  useEffect(() => {
    if (!idPixel) return;
    const script = document.createElement("script");
    script.innerHTML = `
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window,document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${idPixel}');
      fbq('track', 'PageView');
    `;
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, [idPixel]);

  // ─── Google Tag Manager ────────────────────────────────────
  useEffect(() => {
    if (!idTagManager) return;
    const script = document.createElement("script");
    script.innerHTML = `
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${idTagManager}');
    `;
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, [idTagManager]);

  // ─── Lead info ─────────────────────────────────────────────
  const [leadInfo, setLeadInfo] = useState({ name: "", email: "", phone: "" });

  const validateLeadFields = () => {
    const errors: { [key: string]: string } = {};
    if (needLogin) {
      if (showName && !leadInfo.name.trim())
        errors["lead_name"] = "Nome é obrigatório";
      if (showEmail && !leadInfo.email.trim())
        errors["lead_email"] = "E-mail é obrigatório";
      if (showPhone && !leadInfo.phone.trim())
        errors["lead_phone"] = "Telefone é obrigatório";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateFormBlocks = () => {
    const errors: { [key: string]: string } = {};
    blocks.forEach((block) => {
      block.childblocks?.forEach((childblock) => {
        const required = childblock.attributes?.required;
        const blockValue = formVals.current?.[childblock.id]?.value?.trim();
        if (required && (!blockValue || blockValue.trim() === "")) {
          errors[childblock.id] = "Este campo é obrigatório";
        }
      });
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlur = (key: string, value: FieldValue) => {
    formVals.current[key] = { value: value.value, meta: value.meta };
    if (formErrors[key] && value.value.trim() !== "") {
      setFormErrors((prev) => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    }
  };

  const handleSubmit = async () => {
    if (!validateFormBlocks()) {
      toast("Campos obrigatórios não preenchidos");
      return;
    }
    setIsLoading(true);
    const responseJson = JSON.stringify({
      ...formVals.current,
      ...(needLogin && {
        ...(showName && { user_name: leadInfo.name }),
        ...(showEmail && { user_email: leadInfo.email }),
        // Salva o telefone já com DDI
        ...(showPhone && {
          user_phone: normalizePhone(
            `${selectedCountry.ddi} ${leadInfo.phone}`,
          ),
        }),
      }),
    });
    submitResponse.mutate(
      { id, response: responseJson },
      {
        onSuccess: () => {
          setSubmitted(true);
          if (redirectUrl)
            setTimeout(() => {
              window.location.href = redirectUrl;
            }, 2000);
        },
        onError: () => {
          toast("Algo deu errado");
          setIsLoading(false);
        },
      },
    );
  };

  // ─── Button style helper ───────────────────────────────────
  const primaryBtnStyle = {
    backgroundColor: primaryColor || undefined,
    borderColor: primaryColor || undefined,
    color: primaryColor ? getContrastColor(primaryColor) : undefined,
  };

  return (
    <>
      <style>{`
        #lead_name::placeholder  { color: ${textColor}; }
        #lead_email::placeholder { color: ${textColor}; }
      `}</style>

      <div
        className="scrollbar w-full h-full overflow-y-auto pt-3 transition-all duration-300"
        style={{
          backgroundColor: backgroundColor || undefined,
          backgroundImage: backgroundImage
            ? `url(${backgroundImage})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
          backgroundRepeat: "no-repeat",
          color: textColor || undefined,
        }}
      >
        <div className="w-full h-full max-w-[650px] mx-auto">
          <div className="w-full relative bg-transparent px-2 flex flex-col items-center justify-start pt-1 pb-14">
            <div className="w-full h-auto">
              {isSubmitted ? (
                <Card
                  className={cn(
                    "w-full border shadow-sm min-h-[120px] rounded-md p-0",
                    backgroundImage
                      ? "bg-white/20 backdrop-blur-md"
                      : "bg-foreground/10",
                  )}
                  style={{ color: textColor || undefined }}
                >
                  <CardContent className="px-2 pb-2">
                    <div className="py-4 px-3">
                      <h1 className="text-4xl font-normal">{finishMessage}</h1>
                      <p className="mt-2 mb-8 text-base">
                        Recebemos seu formulário
                      </p>
                      {redirectUrl && (
                        <p
                          className={
                            textColor
                              ? "text-sm"
                              : "text-sm text-muted-foreground"
                          }
                          style={textColor ? { opacity: 0.8 } : undefined}
                        >
                          Redirecionando...
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                blocks.length > 0 && (
                  <div
                    className={cn(
                      "flex flex-col w-full gap-4 p-4 rounded-md",
                      backgroundImage
                        ? "bg-white/20 backdrop-blur-md"
                        : "bg-foreground/10",
                    )}
                  >
                    {/* ── Etapa 1: dados do lead ── */}
                    {step === 1 && showLeadFields && (
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
                                <FieldLabel htmlFor="lead_name">
                                  Nome completo
                                </FieldLabel>
                                <Input
                                  id="lead_name"
                                  placeholder="Seu nome"
                                  style={{ color: textColor || undefined }}
                                  value={leadInfo.name}
                                  onChange={(e) =>
                                    setLeadInfo({
                                      ...leadInfo,
                                      name: e.target.value,
                                    })
                                  }
                                />
                                {formErrors["lead_name"] && (
                                  <FieldError>
                                    {formErrors["lead_name"]}
                                  </FieldError>
                                )}
                              </Field>
                            )}

                            {showEmail && (
                              <Field>
                                <FieldLabel htmlFor="lead_email">
                                  E-mail
                                </FieldLabel>
                                <Input
                                  id="lead_email"
                                  placeholder="seu@email.com"
                                  type="email"
                                  style={{ color: textColor || undefined }}
                                  value={leadInfo.email}
                                  onChange={(e) =>
                                    setLeadInfo({
                                      ...leadInfo,
                                      email: e.target.value,
                                    })
                                  }
                                />
                                {formErrors["lead_email"] && (
                                  <FieldError>
                                    {formErrors["lead_email"]}
                                  </FieldError>
                                )}
                              </Field>
                            )}

                            {/* ── Telefone com InputGroup + DDI ── */}
                            {showPhone && (
                              <Field>
                                <FieldLabel htmlFor="lead_phone">
                                  Telefone
                                </FieldLabel>
                                <InputGroup>
                                  <InputGroupAddon align="inline-start">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <InputGroupButton
                                          variant="ghost"
                                          className="text-xs gap-1 px-2"
                                          style={{
                                            color: textColor || undefined,
                                          }}
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
                                              onClick={() =>
                                                setSelectedCountry(country)
                                              }
                                            >
                                              <img
                                                src={country.flag}
                                                alt={country.country}
                                                className="w-5 h-4 rounded-sm"
                                              />
                                              <span className="ml-2">
                                                {country.ddi}
                                              </span>
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
                                    onChange={(e) =>
                                      setLeadInfo({
                                        ...leadInfo,
                                        phone: phoneMask(e.target.value),
                                      })
                                    }
                                  />
                                </InputGroup>
                                {formErrors["lead_phone"] && (
                                  <FieldError>
                                    {formErrors["lead_phone"]}
                                  </FieldError>
                                )}
                              </Field>
                            )}
                          </CardContent>
                        </Card>

                        <Button
                          className="w-full"
                          style={primaryBtnStyle}
                          onClick={() => {
                            if (validateLeadFields()) setStep(2);
                            else toast("Campos obrigatórios não preenchidos");
                          }}
                        >
                          Continuar
                        </Button>
                      </>
                    )}

                    {/* ── Etapa 2: blocos do formulário ── */}
                    {step === 2 && (
                      <>
                        {blocks.map((block) => {
                          const FormBlockComponent =
                            FormBlocks[block.blockType].formComponent;
                          return (
                            <FormBlockComponent
                              key={block.id}
                              blockInstance={block}
                              handleBlur={handleBlur}
                              formErrors={formErrors}
                              settings={settings}
                            />
                          );
                        })}

                        <div className="w-full flex justify-between gap-4">
                          {showLeadFields && (
                            <Button
                              variant="outline"
                              className="bg-transparent border-primary/20"
                              style={{
                                color: textColor || undefined,
                                borderColor: primaryColor || undefined,
                              }}
                              onClick={() => setStep(1)}
                            >
                              Voltar
                            </Button>
                          )}
                          <Button
                            className={showLeadFields ? "flex-1" : "w-full"}
                            disabled={isLoading}
                            style={primaryBtnStyle}
                            onClick={handleSubmit}
                          >
                            {isLoading && (
                              <Spinner className="w-4 h-4 mr-2 animate-spin" />
                            )}
                            Enviar
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
