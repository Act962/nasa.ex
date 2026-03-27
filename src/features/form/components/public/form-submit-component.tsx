"use client";
import { useEffect, useRef, useState } from "react";
import { FormBlockInstance } from "@/features/form/types";
import { Button } from "@/components/ui/button";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import { toast } from "sonner";
import { useMutationSubmitResponse } from "../../hooks/use-form";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { FormSettings } from "@/generated/prisma/client";
import { getContrastColor } from "@/utils/get-contrast-color";

type FormSubmitProps = {
  id: string;
  blocks: FormBlockInstance[];
  settings?: FormSettings | null;
};

export function FormSubmitComponent({ id, blocks, settings }: FormSubmitProps) {
  const submitResponse = useMutationSubmitResponse();

  const formVals = useRef<{ [key: string]: string }>({});
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitted, setSubmitted] = useState<boolean>(false);

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

  const textColor = backgroundColor
    ? getContrastColor(backgroundColor)
    : undefined;

  // ─── Facebook Pixel + GTM ─────────────────────────────────
  useEffect(() => {
    if (idPixel) {
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
    }
  }, [idPixel]);

  useEffect(() => {
    if (idTagManager) {
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
    }
  }, [idTagManager]);

  // ─── Lead info ─────────────────────────────────────────────
  const [leadInfo, setLeadInfo] = useState({
    name: "",
    email: "",
    phone: "",
  });

  // Validate all fields
  const validateFields = () => {
    const errors: { [key: string]: string } = {};

    if (needLogin) {
      if (showName && !leadInfo.name.trim())
        errors["lead_name"] = "Nome é obrigatório";
      if (showEmail && !leadInfo.email.trim())
        errors["lead_email"] = "E-mail é obrigatório";
      if (showPhone && !leadInfo.phone.trim())
        errors["lead_phone"] = "Telefone é obrigatório";
    }

    blocks.forEach((block) => {
      if (!block.childblocks) return;
      block.childblocks?.forEach((childblock) => {
        const required = childblock.attributes?.required;
        const blockValue = formVals.current?.[childblock.id]?.trim();

        if (required && (!blockValue || blockValue.trim() === "")) {
          errors[childblock.id] = "Este campo é obrigatório";
        }
      });
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlur = (key: string, value: string) => {
    formVals.current[key] = value;

    if (formErrors[key] && value?.trim() !== "") {
      setFormErrors((prevErrors) => {
        const updatedErrors = { ...prevErrors };
        delete updatedErrors[key];
        return updatedErrors;
      });
    }
  };

  const handleSubmit = async () => {
    if (!validateFields()) {
      toast("Campos obrigatórios não preenchidos");
      return;
    }

    setIsLoading(true);
    const responseJson = JSON.stringify({
      ...formVals.current,
      ...(needLogin && {
        ...(showName && { user_name: leadInfo.name }),
        ...(showEmail && { user_email: leadInfo.email }),
        ...(showPhone && { user_phone: leadInfo.phone }),
      }),
    });
    submitResponse.mutate(
      { id, response: responseJson },
      {
        onSuccess: () => {
          setSubmitted(true);

          // Redireciona após submissão se configurado
          if (redirectUrl) {
            setTimeout(() => {
              window.location.href = redirectUrl;
            }, 2000);
          }
        },
        onError: () => {
          toast("Algo deu errado");
          setIsLoading(false);
        },
      },
    );
  };

  const showLeadFields = needLogin && (showName || showEmail || showPhone);

  return (
    <div
      className="scrollbar w-full h-full overflow-y-auto pt-3 transition-all duration-300"
      style={{
        backgroundColor: backgroundColor || undefined,
        color: textColor || undefined,
      }}
    >
      <div className="w-full h-full max-w-[650px] mx-auto">
        <div
          className="w-full relative bg-transparent px-2
            flex flex-col items-center justify-start pt-1 pb-14"
        >
          {/* ─── Banner ──────────────────────────────────── */}
          <div
            className="w-full mb-3 bg-foreground/10
             bg-center bg-cover border shadow-sm
             h-[135px] max-w-[768px] rounded-md px-1"
            style={{
              backgroundImage: backgroundImage
                ? `url(${backgroundImage})`
                : "url(/form-bg.jpg)",
            }}
          />

          <div className="w-full h-auto">
            {isSubmitted ? (
              <Card
                className="w-full bg-foreground/10 border
               shadow-sm min-h-[120px] rounded-md p-0"
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
                <div className="flex flex-col w-full gap-4">
                  {showLeadFields && (
                    <Card
                      className="w-full border-none bg-foreground/10 px-4"
                      style={{ color: textColor || undefined }}
                    >
                      <CardContent className="p-0 flex flex-col gap-4">
                        {showName && (
                          <Field>
                            <FieldLabel htmlFor="lead_name">
                              Nome completo
                            </FieldLabel>
                            <Input
                              id="lead_name"
                              placeholder="Seu nome"
                              value={leadInfo.name}
                              onChange={(e) =>
                                setLeadInfo({
                                  ...leadInfo,
                                  name: e.target.value,
                                })
                              }
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
                        {showPhone && (
                          <Field>
                            <FieldLabel htmlFor="lead_phone">
                              Telefone
                            </FieldLabel>
                            <Input
                              id="lead_phone"
                              placeholder="(00) 00000-0000"
                              value={leadInfo.phone}
                              onChange={(e) =>
                                setLeadInfo({
                                  ...leadInfo,
                                  phone: e.target.value,
                                })
                              }
                            />
                            {formErrors["lead_phone"] && (
                              <FieldError>
                                {formErrors["lead_phone"]}
                              </FieldError>
                            )}
                          </Field>
                        )}
                      </CardContent>
                    </Card>
                  )}

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
                  <div className="w-full">
                    <Button
                      disabled={isLoading}
                      onClick={handleSubmit}
                      style={{
                        backgroundColor: primaryColor || undefined,
                        borderColor: primaryColor || undefined,
                        color: primaryColor
                          ? getContrastColor(primaryColor)
                          : undefined,
                      }}
                    >
                      {isLoading && (
                        <Spinner className="w-4 h-4 animate-spin" />
                      )}
                      Enviar
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
