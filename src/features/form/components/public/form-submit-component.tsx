"use client";
import { useEffect, useRef, useState } from "react";
import {
  FieldValue,
  FormBlockInstance,
  HandleBlurFunc,
} from "@/features/form/types";
import { Button } from "@/components/ui/button";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import {
  getCurrentMascot,
  resolveProgressMascots,
} from "@/features/form/lib/progress-mascots";
import {
  appendLeadParams,
  resolveNextButtonAction,
} from "@/features/form/lib/next-button-action";
import { isFillableBlock } from "@/features/form/lib/fillable-blocks";
import {
  FormPrefillProvider,
  type PrefillFieldMap,
} from "@/features/form/context/form-prefill-context";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { toast } from "sonner";
import { useMutationSubmitResponse } from "../../hooks/use-form";
import { getTrackingParamsClient } from "@/lib/tracking/tracking-params";
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
  initialLead?: { name?: string; email?: string; phone?: string };
  /**
   * Modo edição (`/formulario/[slug]/[responseId]`): valores iniciais que
   * serão usados pra pré-preencher os blocos e o `formVals` antes do
   * primeiro render. Cada chave deve ser o `blockInstance.id`.
   */
  initialResponseValues?: Record<string, FieldValue>;
  /**
   * Override do submit. Se passado, é chamado em vez do `submitResponse`
   * público — usado pelo fluxo de edição para chamar
   * `form.updateResponse` em vez de criar nova resposta.
   */
  onSubmitOverride?: (responseJson: string) => Promise<void> | void;
  /**
   * Texto do botão final no modo edição (default: "Enviar"). Quando em
   * edit, usamos "Salvar" pra deixar claro que está atualizando.
   */
  submitLabel?: string;
  /**
   * Modo somente-leitura: usado na rota pública pra cliente final (`/lead/
   * [token]/formulario/[responseId]`). Bloqueia interação em todos os
   * inputs via CSS, EXCETO blocos marcados com `[data-allow-interaction]`
   * (atualmente: SignatureClient). Quando ligado, o submit chama o
   * `onSubmitOverride` apenas com as alterações de assinatura.
   */
  readOnly?: boolean;
};

export function FormSubmitComponent({
  id,
  blocks,
  settings,
  initialLead,
  initialResponseValues,
  onSubmitOverride,
  submitLabel,
  readOnly,
}: FormSubmitProps) {
  const submitResponse = useMutationSubmitResponse();

  const formVals = useRef<{ [key: string]: FieldValue }>(
    // Inicializa com valores existentes no fluxo edit. No fluxo público fica vazio.
    initialResponseValues ? { ...initialResponseValues } : {},
  );

  // Mapa de prefill (FieldValue completo: value + meta) pra o contexto que
  // alimenta os blocos. Blocos simples consomem só `.value` via
  // `usePrefillValue`; blocos compostos (UserSelect, FileUpload, Signature)
  // leem o FieldValue inteiro via `usePrefillFieldValue` pra extrair IDs,
  // URLs S3, dataURLs etc. salvos em `meta`.
  const prefillMap: PrefillFieldMap = (() => {
    if (!initialResponseValues) return {};
    const map: PrefillFieldMap = {};
    for (const [k, v] of Object.entries(initialResponseValues)) {
      if (v && typeof v === "object" && typeof v.value === "string") {
        map[k] = v;
      }
    }
    return map;
  })();
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

  // No modo edição (override presente), o lead já existe — pulamos a etapa
  // de coleta de dados pessoais e vamos direto pros blocos do formulário.
  const isEditMode = !!onSubmitOverride;
  const showLeadFields = !isEditMode && needLogin && (showName || showEmail || showPhone);
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
  const [leadInfo, setLeadInfo] = useState({
    name: initialLead?.name ?? "",
    email: initialLead?.email ?? "",
    phone: initialLead?.phone ?? "",
  });

  // Reaplica quando o prefill chega via prop assíncrona (ex.: token query)
  useEffect(() => {
    if (!initialLead) return;
    setLeadInfo((prev) => ({
      name: prev.name || (initialLead.name ?? ""),
      email: prev.email || (initialLead.email ?? ""),
      phone: prev.phone || (initialLead.phone ?? ""),
    }));
  }, [initialLead?.name, initialLead?.email, initialLead?.phone]);

  // Prefill via query string (origem: outro form com action="form" ou
  // "external_link" com passLeadData ligado). Lê uma vez no mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const qName = params.get("name");
      const qEmail = params.get("email");
      const qPhone = params.get("phone");
      if (!qName && !qEmail && !qPhone) return;
      setLeadInfo((prev) => ({
        name: prev.name || qName || "",
        email: prev.email || qEmail || "",
        phone: prev.phone || qPhone || "",
      }));
    } catch {
      // ignora — query inválida não deve quebrar o form
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // Captura UTMs/origem do session storage (preenchidos pelo middleware
    // ou pela primeira navegação do usuário). Best-effort: nada quebra se vazio.
    const tracking = getTrackingParamsClient();

    // Modo edição/interno: chama o override (form.updateResponse ou
    // form.createResponseForLead). NÃO setamos `isSubmitted=true` — o
    // form continua editável pra o consultor poder salvar várias vezes.
    // O toast de sucesso/erro é responsabilidade do override (na página
    // /formulario/...), assim como o eventual redirect pra URL canônica
    // de edição (após criar a resposta no fluxo "novo").
    if (onSubmitOverride) {
      try {
        await onSubmitOverride(responseJson);
      } catch {
        // O override já mostra o toast de erro; aqui só liberamos o botão.
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Configuração da ação do botão "Próximo" no último passo (manual mode).
    // Se for "add_tag", anexa tagId ao request pra ser aplicado server-side.
    // Se for "form" / "external_link", usa o leadId/token retornado pra
    // redirecionar com dados do lead.
    const nextAction = resolveNextButtonAction(
      (settings as { nextButtonAction?: unknown } | null | undefined)
        ?.nextButtonAction,
    );

    submitResponse.mutate(
      {
        id,
        response: responseJson,
        tracking,
        ...(nextAction.type === "add_tag" && nextAction.tagId
          ? { nextActionTagId: nextAction.tagId }
          : {}),
      },
      {
        onSuccess: (res) => {
          setSubmitted(true);
          const leadInfoOut =
            (res as unknown as {
              lead?: {
                id: string | null;
                name: string | null;
                email: string | null;
                phone: string | null;
                publicToken: string | null;
              } | null;
            })?.lead ?? null;

          // Redireciona pra outro form
          if (nextAction.type === "form" && nextAction.formId) {
            const url = `/submit-form/${nextAction.formId}`;
            const target =
              nextAction.passLeadData !== false && leadInfoOut
                ? appendLeadParams(url, leadInfoOut)
                : url;
            setTimeout(() => {
              window.location.href = target;
            }, 1200);
            return;
          }

          // Redireciona pra link externo
          if (nextAction.type === "external_link" && nextAction.externalUrl) {
            const target =
              nextAction.passLeadData !== false && leadInfoOut
                ? appendLeadParams(nextAction.externalUrl, leadInfoOut)
                : nextAction.externalUrl;
            setTimeout(() => {
              window.location.href = target;
            }, 1200);
            return;
          }

          // Redirecionamento legado (Settings > Integrações > URL de
          // redirecionamento) — só se não houver ação configurada.
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

  // ─── Button style helper ───────────────────────────────────
  const primaryBtnStyle = {
    backgroundColor: primaryColor || undefined,
    borderColor: primaryColor || undefined,
    color: primaryColor ? getContrastColor(primaryColor) : undefined,
  };

  return (
    <FormPrefillProvider values={prefillMap}>
      <style>{`
        #lead_name::placeholder  { color: ${textColor}; }
        #lead_email::placeholder { color: ${textColor}; }
        /* Modo read-only (cliente final visualiza form): trava interação em
           todos os inputs/selects/checkboxes EXCETO em elementos marcados
           com [data-allow-interaction] (Signature do cliente). */
        [data-form-readonly="true"] input:not([data-allow-interaction] input),
        [data-form-readonly="true"] textarea:not([data-allow-interaction] textarea),
        [data-form-readonly="true"] select,
        [data-form-readonly="true"] [role="combobox"],
        [data-form-readonly="true"] [role="checkbox"],
        [data-form-readonly="true"] [role="radio"],
        [data-form-readonly="true"] [role="slider"],
        [data-form-readonly="true"] [data-slot="select-trigger"],
        [data-form-readonly="true"] [data-slot="popover-trigger"],
        [data-form-readonly="true"] [data-slot="dropdown-menu-trigger"] {
          pointer-events: none !important;
          opacity: 0.85;
        }
        /* Botões de ação dos blocos (limpar assinatura, etc) ficam OK
           dentro de [data-allow-interaction]. Demais buttons travados. */
        [data-form-readonly="true"] button:not([data-allow-interaction] button):not([data-form-submit]) {
          pointer-events: none !important;
          opacity: 0.6;
        }
        [data-form-readonly="true"] [data-allow-interaction],
        [data-form-readonly="true"] [data-allow-interaction] * {
          pointer-events: auto !important;
          opacity: 1 !important;
        }
      `}</style>

      <div
        data-form-readonly={readOnly ? "true" : undefined}
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
                      <StepBlocks
                        blocks={blocks}
                        settings={settings}
                        handleBlur={handleBlur}
                        formErrors={formErrors}
                        isLoading={isLoading}
                        textColor={textColor}
                        primaryColor={primaryColor}
                        primaryBtnStyle={primaryBtnStyle}
                        showLeadFields={showLeadFields}
                        formValsRef={formVals}
                        onBack={() => setStep(1)}
                        onSubmit={handleSubmit}
                        submitLabel={submitLabel}
                      />
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </FormPrefillProvider>
  );
}

function StepBlocks({
  blocks,
  settings,
  handleBlur,
  formErrors,
  isLoading,
  textColor,
  primaryColor,
  primaryBtnStyle,
  showLeadFields,
  formValsRef,
  onBack,
  onSubmit,
  submitLabel,
}: {
  blocks: FormBlockInstance[];
  settings?: FormSettings | null;
  handleBlur: HandleBlurFunc;
  formErrors: { [key: string]: string };
  isLoading: boolean;
  textColor?: string;
  primaryColor?: string;
  primaryBtnStyle: React.CSSProperties;
  showLeadFields: boolean;
  formValsRef: React.MutableRefObject<{ [key: string]: FieldValue }>;
  onBack: () => void;
  onSubmit: () => void;
  submitLabel?: string;
}) {
  const stepMode =
    ((settings as unknown as { stepMode?: string })?.stepMode ?? "off") as
      | "off"
      | "auto"
      | "manual";
  const nextLabel =
    (settings as unknown as { nextButtonLabel?: string })?.nextButtonLabel ||
    "Próximo";

  const [currentStep, setCurrentStep] = useState(0);
  const [tick, setTick] = useState(0); // re-render quando formVals muda

  // re-render automático ao receber preenchimento — pra que o auto-advance e
  // o botão habilitado/desabilitado reflitam o estado atual de `formValsRef`.
  const wrappedHandleBlur: HandleBlurFunc = (key, value) => {
    handleBlur(key, value);
    setTick((t) => t + 1);
  };

  // Modo "tudo de uma vez"
  if (stepMode === "off") {
    return (
      <>
        {blocks.map((block) => {
          const FormBlockComponent = FormBlocks[block.blockType].formComponent;
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
        <SubmitButtons
          showLeadFields={showLeadFields}
          isLoading={isLoading}
          onBack={onBack}
          onSubmit={onSubmit}
          textColor={textColor}
          primaryColor={primaryColor}
          primaryBtnStyle={primaryBtnStyle}
          submitLabel={submitLabel}
        />
      </>
    );
  }

  // Helpers pra checar se um grupo está completo (todos os campos required preenchidos)
  const isGroupComplete = (group: FormBlockInstance) => {
    const childs = group.childblocks ?? [];
    if (childs.length === 0) return true;
    for (const child of childs) {
      // Pula blocos não-preenchíveis (Heading, Paragraph, ImageDisplay, etc.)
      if (
        !isFillableBlock(child.blockType, FormBlocks[child.blockType]?.blockCategory)
      )
        continue;

      // SignatureUser com responsável pré-cadastrado vira um GATE: o
      // botão "Próximo" trava até essa assinatura existir, mesmo que o
      // bloco não esteja marcado como `required`.
      const isSignatureGate =
        child.blockType === "SignatureUser" &&
        !!child.attributes?.assigneeUserId;

      const required = child.attributes?.required || isSignatureGate;
      if (!required) continue;
      const v = formValsRef.current?.[child.id]?.value?.trim();
      if (!v) return false;
    }
    return true;
  };

  // Auto-advance: quando o grupo atual fica completo, avança sozinho
  if (
    stepMode === "auto" &&
    currentStep < blocks.length - 1 &&
    isGroupComplete(blocks[currentStep])
  ) {
    // setTimeout pra evitar update durante render
    setTimeout(() => setCurrentStep((s) => Math.min(s + 1, blocks.length - 1)), 0);
  }

  const currentBlock = blocks[currentStep];
  const isLast = currentStep === blocks.length - 1;
  const canAdvance = isGroupComplete(currentBlock);

  void tick; // referenciar pra evitar dead-state warning

  if (!currentBlock) return null;

  // Progresso simples: campos preenchidos / total de blocos preenchíveis.
  // Form vazio → 0%. Cada campo que ganha valor incrementa proporcional.
  // Heading/Paragraph/ImageDisplay (decorativos) ficam fora via
  // `isFillableBlock`. Sliders commitam o `defaultValue` no mount, então
  // contam desde o início — correto, já que o default é uma resposta válida.
  const allChildren = blocks
    .flatMap((b) => b.childblocks ?? [])
    .filter((c) =>
      isFillableBlock(c.blockType, FormBlocks[c.blockType]?.blockCategory),
    );
  const totalFields = allChildren.length;
  const filledFields = allChildren.filter((c) => {
    const v = formValsRef.current?.[c.id]?.value?.trim();
    return Boolean(v);
  }).length;
  const progressPct =
    totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

  // Mascote da barra de progresso — pode ser customizado em
  // settings.progressMascots (lista de { min, max, emoji?, imageUrl?, label }).
  // Cai no default se não houver configuração.
  const mascots = resolveProgressMascots(
    (settings as unknown as { progressMascots?: unknown })?.progressMascots,
  );
  const currentMascot = getCurrentMascot(mascots, progressPct);

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="text-xs text-muted-foreground/80">
          Passo {currentStep + 1} de {blocks.length}
        </span>
        <div className="flex items-center gap-2 flex-1 max-w-[60%]">
          <div className="relative h-1.5 flex-1 rounded-full bg-foreground/10 overflow-visible">
            {/* Faixa de fill */}
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
              style={{
                width: `${progressPct}%`,
                backgroundColor: primaryColor || "hsl(var(--primary))",
              }}
            />
            <ProgressMascotIcon
              mascot={currentMascot}
              progressPct={progressPct}
            />
          </div>
          <span
            className="text-[11px] font-medium tabular-nums shrink-0"
            style={{ color: textColor || undefined }}
            title={`${filledFields} de ${totalFields} campos preenchidos`}
          >
            {progressPct}%
          </span>
        </div>
      </div>
      {/* Mantém TODOS os passos montados, escondendo os que não são o atual.
          Isso preserva o estado local (texto digitado, escolhas, etc.) quando
          o usuário navega entre passos com Próximo/Voltar — o componente não
          é desmontado, então `formValsRef` e o estado interno do bloco ficam
          intactos. Resolve "ao clicar em próximo, os dados não são salvos". */}
      {blocks.map((block, idx) => {
        const Comp = FormBlocks[block.blockType].formComponent;
        const visible = idx === currentStep;
        return (
          <div
            key={block.id}
            style={{ display: visible ? undefined : "none" }}
            aria-hidden={!visible}
          >
            <Comp
              blockInstance={block}
              handleBlur={wrappedHandleBlur}
              formErrors={formErrors}
              settings={settings}
            />
          </div>
        );
      })}

      <div className="w-full flex justify-between gap-4">
        {currentStep > 0 ? (
          <Button
            variant="outline"
            className="bg-transparent border-primary/20"
            style={{
              color: textColor || undefined,
              borderColor: primaryColor || undefined,
            }}
            onClick={() => setCurrentStep((s) => Math.max(s - 1, 0))}
          >
            Voltar
          </Button>
        ) : (
          showLeadFields && (
            <Button
              variant="outline"
              className="bg-transparent border-primary/20"
              style={{
                color: textColor || undefined,
                borderColor: primaryColor || undefined,
              }}
              onClick={onBack}
            >
              Voltar
            </Button>
          )
        )}

        {isLast ? (
          <Button
            data-form-submit
            className="flex-1"
            disabled={isLoading}
            style={primaryBtnStyle}
            onClick={onSubmit}
          >
            {isLoading && <Spinner className="w-4 h-4 mr-2 animate-spin" />}
            {submitLabel ?? "Enviar"}
          </Button>
        ) : (
          stepMode === "manual" && (
            <Button
              className="flex-1"
              // Visual de disabled mas continua clicável pra mostrar
              // a mensagem de gate (assinatura faltando ou não autorizada).
              aria-disabled={!canAdvance}
              style={{
                ...primaryBtnStyle,
                opacity: canAdvance ? 1 : 0.5,
                cursor: canAdvance ? undefined : "not-allowed",
              }}
              onClick={() => {
                if (canAdvance) {
                  setCurrentStep((s) => Math.min(s + 1, blocks.length - 1));
                  return;
                }
                // Detecta se há assinatura-gate não satisfeita no passo
                // atual e devolve mensagem específica pro user.
                const gate = (currentBlock.childblocks ?? []).find((c) => {
                  if (c.blockType !== "SignatureUser") return false;
                  if (!c.attributes?.assigneeUserId) return false;
                  const v = formValsRef.current?.[c.id]?.value?.trim();
                  return !v;
                });
                if (gate) {
                  toast.error(
                    `Você não é autorizado a assinar esse campo. Aguardando ${
                      (gate.attributes as { assigneeName?: string })
                        ?.assigneeName ?? "o responsável"
                    }.`,
                  );
                }
              }}
            >
              {nextLabel}
            </Button>
          )
        )}
      </div>
    </>
  );
}

function SubmitButtons({
  showLeadFields,
  isLoading,
  onBack,
  onSubmit,
  textColor,
  primaryColor,
  primaryBtnStyle,
  submitLabel,
}: {
  showLeadFields: boolean;
  isLoading: boolean;
  onBack: () => void;
  onSubmit: () => void;
  textColor?: string;
  primaryColor?: string;
  primaryBtnStyle: React.CSSProperties;
  submitLabel?: string;
}) {
  return (
    <div className="w-full flex justify-between gap-4">
      {showLeadFields && (
        <Button
          variant="outline"
          className="bg-transparent border-primary/20"
          style={{
            color: textColor || undefined,
            borderColor: primaryColor || undefined,
          }}
          onClick={onBack}
        >
          Voltar
        </Button>
      )}
      <Button
        data-form-submit
        className={showLeadFields ? "flex-1" : "w-full"}
        disabled={isLoading}
        style={primaryBtnStyle}
        onClick={onSubmit}
      >
        {isLoading && <Spinner className="w-4 h-4 mr-2 animate-spin" />}
        {submitLabel ?? "Enviar"}
      </Button>
    </div>
  );
}

function ProgressMascotIcon({
  mascot,
  progressPct,
}: {
  mascot: { emoji?: string; imageUrl?: string; label: string };
  progressPct: number;
}) {
  const imageSrc = useConstructUrl(mascot.imageUrl || "");
  return (
    <span
      aria-hidden="true"
      title={`${mascot.label} (${progressPct}%)`}
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 leading-none select-none transition-[left] duration-500 ease-out drop-shadow-sm flex items-center justify-center"
      style={{
        left: `${progressPct}%`,
        filter:
          progressPct === 100
            ? "drop-shadow(0 0 6px rgba(250,204,21,0.6))"
            : undefined,
      }}
    >
      {mascot.imageUrl ? (
        <img
          src={imageSrc}
          alt={mascot.label}
          className="w-6 h-6 object-contain rounded"
          draggable={false}
        />
      ) : (
        <span className="text-base">{mascot.emoji || "•"}</span>
      )}
    </span>
  );
}
