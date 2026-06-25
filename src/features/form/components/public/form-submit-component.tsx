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
import { normalizeRedirectUrl } from "@/features/form/lib/normalize-redirect-url";
import { isFillableBlock } from "@/features/form/lib/fillable-blocks";
import {
  FormPrefillProvider,
  type PrefillFieldMap,
} from "@/features/form/context/form-prefill-context";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { toast } from "sonner";
import {
  useMutationSubmitResponse,
  useMutationSavePartialResponse,
  useMutationValidateLeadPhone,
} from "../../hooks/use-form";
import { getTrackingParamsClient } from "@/lib/tracking/tracking-params";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
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
import type { FormSettingsTyped } from "@/features/form/types";
import { getContrastColor } from "@/utils/get-contrast-color";
import { cn } from "@/lib/utils";
import { countries } from "@/types/some";
import { normalizePhone, phoneMask } from "@/utils/format-phone";

const LOCAL_DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000;

type FormSubmitProps = {
  id: string;
  blocks: FormBlockInstance[];
  settings?: FormSettings | FormSettingsTyped | null;
  initialLead?: { name?: string; email?: string; phone?: string };
  initialResponseValues?: Record<string, FieldValue>;
  onSubmitOverride?: (responseJson: string) => Promise<void> | void;
  submitLabel?: string;
  readOnly?: boolean;
  onPartialSave?: (
    responseJson: string,
    currentResponseId: string | null,
  ) => Promise<{ responseId: string } | null | undefined>;
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
  onPartialSave,
}: FormSubmitProps) {
  const submitResponse = useMutationSubmitResponse();
  const savePartialResponse = useMutationSavePartialResponse();
  const findDraft = useMutation(orpc.form.findDraftByPhone.mutationOptions({}));
  const validateLeadPhone = useMutationValidateLeadPhone();
  const [resumeLoading, setResumeLoading] = useState(false);

  const responseIdStorageKey = `nasa.form.draft.${id}`;
  const localStorageDraftKey = `nasa.form.ls.${id}`;

  const pendingLocalDraftRef = useRef<{
    fv: Record<string, FieldValue>;
    contact?: { phone?: string; ddi?: string; email?: string };
  } | null>(null);

  const responseIdRef = useRef<string | null>(
    typeof window !== "undefined" && !initialResponseValues
      ? sessionStorage.getItem(responseIdStorageKey)
      : null,
  );
  const savingPartialRef = useRef(false);
  const dbSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formVals = useRef<{ [key: string]: FieldValue }>(
    initialResponseValues ? { ...initialResponseValues } : {},
  );

  const saveDraftToLocalStorage = () => {
    if (typeof window === "undefined") return;
    if (initialResponseValues) return;
    try {
      localStorage.setItem(
        localStorageDraftKey,
        JSON.stringify({
          fv: formVals.current,
          savedAt: Date.now(),
          contact: {
            phone: leadInfo.phone,
            ddi: selectedCountry.ddi,
            email: leadInfo.email,
          },
        }),
      );
    } catch {
      /* quota ou modo privado — ignorar */
    }
  };

  const clearLocalStorageDraft = () => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(localStorageDraftKey);
    } catch {
      /* ignorar */
    }
  };

  const sessionKeyRef = useRef<string>(`form-${id}-${Date.now()}`);

  const [prefillMap, setPrefillMap] = useState<PrefillFieldMap>(() => {
    if (!initialResponseValues) return {};
    const map: PrefillFieldMap = {};
    for (const [k, v] of Object.entries(initialResponseValues)) {
      if (v && typeof v === "object" && typeof v.value === "string") {
        map[k] = v;
      }
    }
    return map;
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setSubmitted] = useState(false);

  const [selectedCountry, setSelectedCountry] = useState(countries[0]);

  const showName = settings?.showName ?? true;
  const showEmail = settings?.showEmail ?? true;
  const showPhone = settings?.showPhone ?? true;
  const needLogin = settings?.needLogin ?? true;
  const finishMessage = settings?.finishMessage ?? "Obrigado por seu cadastro!";
  const primaryColor = settings?.primaryColor ?? undefined;
  const backgroundColor = settings?.backgroundColor ?? undefined;
  const backgroundImage = settings?.backgroundImage ?? undefined;
  const redirectUrl = settings?.redirectUrl ?? undefined;

  const isEditMode = !!onSubmitOverride;
  const showLeadFields =
    !isEditMode && needLogin && (showName || showEmail || showPhone);
  const [step, setStep] = useState(showLeadFields ? 1 : 2);
  const textColor = backgroundColor
    ? getContrastColor(backgroundColor)
    : undefined;

  const [leadInfo, setLeadInfo] = useState({
    name: initialLead?.name ?? "",
    email: initialLead?.email ?? "",
    phone: initialLead?.phone ?? "",
  });

  useEffect(() => {
    if (!initialLead) return;
    setLeadInfo((prev) => ({
      name: prev.name || (initialLead.name ?? ""),
      email: prev.email || (initialLead.email ?? ""),
      phone: prev.phone || (initialLead.phone ?? ""),
    }));
  }, [initialLead?.name, initialLead?.email, initialLead?.phone]);

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

  const isFieldFilled = (v: FieldValue | undefined): boolean => {
    if (!v) return false;
    const val = v.value as unknown;
    if (val == null) return false;
    if (typeof val === "string") return val.trim().length > 0;
    if (typeof val === "number") return !Number.isNaN(val);
    if (typeof val === "boolean") return val;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "object") return Object.keys(val).length > 0;
    return false;
  };

  const validateFormBlocks = () => {
    const errors: { [key: string]: string } = {};
    const walk = (block: FormBlockInstance) => {
      if (block.attributes?.required) {
        const v = formVals.current?.[block.id];
        if (!isFieldFilled(v)) {
          errors[block.id] = "Este campo é obrigatório";
        }
      }
      block.childblocks?.forEach(walk);
    };
    blocks.forEach(walk);
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBlur = (key: string, value: FieldValue) => {
    formVals.current[key] = { value: value.value, meta: value.meta };
    if (
      formErrors[key] &&
      isFieldFilled({ value: value.value, meta: value.meta })
    ) {
      setFormErrors((prev) => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    }
    saveDraftToLocalStorage();
    if (dbSaveDebounceRef.current) clearTimeout(dbSaveDebounceRef.current);
    dbSaveDebounceRef.current = setTimeout(() => {
      void persistPartial();
    }, 1500);
  };

  const persistPartial = async () => {
    if (onSubmitOverride && !onPartialSave) return;
    if (dbSaveDebounceRef.current) {
      clearTimeout(dbSaveDebounceRef.current);
      dbSaveDebounceRef.current = null;
    }
    if (savingPartialRef.current) return;
    savingPartialRef.current = true;
    try {
      const responseJson = JSON.stringify({
        ...formVals.current,
        ...(needLogin && {
          ...(showName && { user_name: leadInfo.name }),
          ...(showEmail && { user_email: leadInfo.email }),
          ...(showPhone && {
            user_phone: normalizePhone(
              `${selectedCountry.ddi} ${leadInfo.phone}`,
            ),
          }),
        }),
      });

      if (onPartialSave) {
        const result = await onPartialSave(responseJson, responseIdRef.current);
        if (result?.responseId) {
          responseIdRef.current = result.responseId;
        }
        return;
      }

      const tracking = getTrackingParamsClient();
      const result = await savePartialResponse.mutateAsync({
        id,
        response: responseJson,
        tracking,
        ...(responseIdRef.current ? { responseId: responseIdRef.current } : {}),
      });
      if (result?.responseId) {
        responseIdRef.current = result.responseId;
        try {
          sessionStorage.setItem(responseIdStorageKey, result.responseId);
        } catch {
          /* private mode / quota — ignore */
        }
      }
    } catch (err) {
      console.warn("[form] auto-save falhou", err);
    } finally {
      savingPartialRef.current = false;
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
        ...(showPhone && {
          user_phone: normalizePhone(
            `${selectedCountry.ddi} ${leadInfo.phone}`,
          ),
        }),
      }),
    });
    const tracking = getTrackingParamsClient();

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

    const nextAction = resolveNextButtonAction(
      (settings as { nextButtonAction?: unknown } | null | undefined)
        ?.nextButtonAction,
    );

    submitResponse.mutate(
      {
        id,
        response: responseJson,
        tracking,
        ...(responseIdRef.current ? { responseId: responseIdRef.current } : {}),
        ...(nextAction.type === "add_tag" && nextAction.tagId
          ? { nextActionTagId: nextAction.tagId }
          : {}),
      },
      {
        onSuccess: (res) => {
          setSubmitted(true);
          clearLocalStorageDraft();
          try {
            const keys: string[] = [];
            for (let i = 0; i < sessionStorage.length; i++) {
              const k = sessionStorage.key(i);
              if (
                k &&
                (k.startsWith("nasa.form.image-upload.") ||
                  k.startsWith("nasa.form.signature.") ||
                  k.startsWith("nasa.form.draft."))
              ) {
                keys.push(k);
              }
            }
            keys.forEach((k) => sessionStorage.removeItem(k));
            responseIdRef.current = null;
          } catch {
            /* ignore */
          }
          const leadInfoOut =
            (
              res as unknown as {
                lead?: {
                  id: string | null;
                  name: string | null;
                  email: string | null;
                  phone: string | null;
                  publicToken: string | null;
                } | null;
              }
            )?.lead ?? null;

          const normalizedRedirect = normalizeRedirectUrl(redirectUrl);
          if (normalizedRedirect) {
            setTimeout(() => {
              window.location.href = normalizedRedirect;
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

  const primaryBtnStyle = {
    backgroundColor: primaryColor || undefined,
    borderColor: primaryColor || undefined,
    color: primaryColor ? getContrastColor(primaryColor) : undefined,
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initialResponseValues) return;
    try {
      const raw = localStorage.getItem(localStorageDraftKey);
      if (!raw) return;
      const localDraft = JSON.parse(raw) as {
        fv?: Record<string, FieldValue>;
        savedAt?: number;
        contact?: { phone?: string; ddi?: string; email?: string };
      };
      if (!localDraft.fv || !localDraft.savedAt) return;
      if (Date.now() - localDraft.savedAt > LOCAL_DRAFT_EXPIRY_MS) {
        localStorage.removeItem(localStorageDraftKey);
        return;
      }
      if (showLeadFields) {
        pendingLocalDraftRef.current = {
          fv: localDraft.fv,
          contact: localDraft.contact,
        };
        return;
      }
      const hydratedMap: PrefillFieldMap = {};
      for (const [k, v] of Object.entries(localDraft.fv)) {
        if (v && typeof v === "object" && typeof v.value === "string") {
          formVals.current[k] = v;
          hydratedMap[k] = v;
        }
      }
      if (Object.keys(hydratedMap).length > 0) {
        setPrefillMap(hydratedMap);
        toast.success("Retomando onde você parou", {
          description: "Seus respostas foram restauradas automaticamente.",
        });
      }
    } catch {
      /* JSON inválido ou localStorage indisponível — ignorar */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (dbSaveDebounceRef.current) clearTimeout(dbSaveDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initialResponseValues) return;
    try {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (
          k &&
          (k.startsWith("nasa.form.image-upload.") ||
            k.startsWith("nasa.form.signature."))
        ) {
          keys.push(k);
        }
      }
      keys.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      /* sessionStorage indisponível (private mode, quota) — ignorar */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FormPrefillProvider values={prefillMap} sessionKey={sessionKeyRef.current}>
      <style>{`
        #lead_name::placeholder  { color: ${textColor}; }
        #lead_email::placeholder { color: ${textColor}; }
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
        data-form-scroll-container
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
        <div className="w-full h-full mx-auto max-w-full xl:max-w-162.5">
          <div className="w-full relative bg-transparent px-4 sm:px-6 md:px-8 xl:px-2 flex flex-col items-center justify-start pt-1 pb-14">
            <div className="w-full h-auto">
              {isSubmitted ? (
                <Card
                  className={cn(
                    "w-full border shadow-sm min-h-30 rounded-md p-0",
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
                      "flex flex-col w-full gap-3 xl:gap-4 p-3 xl:p-4 rounded-md border shadow-sm",
                      backgroundImage
                        ? "bg-white/20 backdrop-blur-md border-white/30"
                        : "bg-foreground/10 border-foreground/15",
                    )}
                  >
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
                          className="w-full max-w-[80%] mx-auto"
                          style={primaryBtnStyle}
                          disabled={resumeLoading}
                          onClick={async () => {
                            if (!validateLeadFields()) {
                              toast("Campos obrigatórios não preenchidos");
                              return;
                            }
                            responseIdRef.current = null;
                            try {
                              sessionStorage.removeItem(responseIdStorageKey);
                            } catch {
                              /* ignore */
                            }

                            if (
                              showPhone &&
                              leadInfo.phone.trim() &&
                              !onSubmitOverride
                            ) {
                              setResumeLoading(true);
                              try {
                                const phoneNormalized = normalizePhone(
                                  `${selectedCountry.ddi} ${leadInfo.phone}`,
                                );
                                const { result } =
                                  await validateLeadPhone.mutateAsync({
                                    formId: id,
                                    phone: phoneNormalized,
                                  });
                                if (result.status === "invalid") {
                                  setFormErrors({
                                    lead_phone: "Número de telefone inválido",
                                  });
                                  toast.error(
                                    "O telefone informado não é um número válido.",
                                  );
                                  setResumeLoading(false);
                                  return;
                                }
                              } catch (err) {
                                console.warn(
                                  "[form] validateLeadPhone failed",
                                  err,
                                );
                              } finally {
                                setResumeLoading(false);
                              }
                            }

                            if (
                              showPhone &&
                              leadInfo.phone.trim() &&
                              !onSubmitOverride
                            ) {
                              setResumeLoading(true);
                              try {
                                const phoneNormalized = normalizePhone(
                                  `${selectedCountry.ddi} ${leadInfo.phone}`,
                                );
                                const result = await findDraft.mutateAsync({
                                  formId: id,
                                  phone: phoneNormalized,
                                });
                                const draft = (
                                  result as {
                                    draft?: {
                                      responseId: string;
                                      jsonResponse: unknown;
                                      createdAt: string | Date;
                                    } | null;
                                  } | null
                                )?.draft;
                                if (draft) {
                                  let parsed: Record<string, unknown> = {};
                                  try {
                                    parsed =
                                      typeof draft.jsonResponse === "string"
                                        ? JSON.parse(draft.jsonResponse)
                                        : (draft.jsonResponse as Record<
                                            string,
                                            unknown
                                          >);
                                  } catch {
                                    /* ignore parse error */
                                  }
                                  const hydrated: PrefillFieldMap = {};
                                  for (const [k, v] of Object.entries(parsed)) {
                                    if (
                                      v &&
                                      typeof v === "object" &&
                                      "value" in
                                        (v as Record<string, unknown>) &&
                                      typeof (v as { value?: unknown })
                                        .value === "string"
                                    ) {
                                      hydrated[k] = v as {
                                        value: string;
                                        meta?: Record<string, unknown>;
                                      };
                                      formVals.current[k] = hydrated[k] as {
                                        value: string;
                                        meta?: Record<string, unknown>;
                                      };
                                    }
                                  }
                                  if (Object.keys(hydrated).length > 0) {
                                    setPrefillMap(hydrated);
                                    responseIdRef.current = draft.responseId;
                                    try {
                                      sessionStorage.setItem(
                                        responseIdStorageKey,
                                        draft.responseId,
                                      );
                                    } catch {
                                      /* ignore */
                                    }
                                    clearLocalStorageDraft();
                                    pendingLocalDraftRef.current = null;
                                    toast.success(
                                      "Continuando rascunho salvo",
                                      {
                                        description:
                                          "Os campos preenchidos antes foram restaurados.",
                                      },
                                    );
                                  }
                                }
                              } catch (err) {
                                console.warn("[form] findDraft failed", err);
                              } finally {
                                setResumeLoading(false);
                              }
                            }

                            if (pendingLocalDraftRef.current) {
                              const pendingDraft = pendingLocalDraftRef.current;
                              pendingLocalDraftRef.current = null;

                              const savedPhone =
                                pendingDraft.contact?.phone ?? "";
                              const savedDdi =
                                pendingDraft.contact?.ddi ?? "";
                              const savedEmail =
                                pendingDraft.contact?.email ?? "";

                              const savedNormalized = normalizePhone(
                                `${savedDdi} ${savedPhone}`,
                              );
                              const enteredNormalized = normalizePhone(
                                `${selectedCountry.ddi} ${leadInfo.phone}`,
                              );

                              const phoneMatches =
                                showPhone &&
                                !!savedNormalized &&
                                savedNormalized === enteredNormalized;

                              const emailMatches =
                                !showPhone &&
                                showEmail &&
                                !!savedEmail &&
                                !!leadInfo.email &&
                                savedEmail.trim().toLowerCase() ===
                                  leadInfo.email.trim().toLowerCase();

                              if (phoneMatches || emailMatches) {
                                const hydratedMap: PrefillFieldMap = {};
                                for (const [k, v] of Object.entries(
                                  pendingDraft.fv,
                                )) {
                                  if (
                                    v &&
                                    typeof v === "object" &&
                                    typeof v.value === "string"
                                  ) {
                                    formVals.current[k] = v;
                                    hydratedMap[k] = v;
                                  }
                                }
                                if (Object.keys(hydratedMap).length > 0) {
                                  setPrefillMap(hydratedMap);
                                  toast.success("Retomando onde você parou", {
                                    description:
                                      "Suas respostas foram restauradas automaticamente.",
                                  });
                                }
                              } else {
                                clearLocalStorageDraft();
                              }
                            }

                            setStep(2);
                          }}
                        >
                          {resumeLoading ? "Verificando..." : "Continuar"}
                        </Button>
                      </>
                    )}

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
                        onStepAdvance={persistPartial}
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
  onStepAdvance,
}: {
  blocks: FormBlockInstance[];
  settings?: FormSettings | FormSettingsTyped | null;
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
  onStepAdvance?: () => Promise<void> | void;
}) {
  const stepMode = ((settings as unknown as { stepMode?: string })?.stepMode ??
    "off") as "off" | "auto" | "manual";
  const nextLabel =
    (settings as unknown as { nextButtonLabel?: string })?.nextButtonLabel ||
    "Próximo";

  const [currentStep, setCurrentStep] = useState(0);
  const [tick, setTick] = useState(0);

  const wrappedHandleBlur: HandleBlurFunc = (key, value) => {
    handleBlur(key, value);
    setTick((t) => t + 1);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const scrollEl = document.querySelector(
      "[data-form-scroll-container]",
    ) as HTMLElement | null;
    if (scrollEl) {
      scrollEl.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep]);

  void tick;
  const allChildrenAll = blocks
    .flatMap((b) => b.childblocks ?? [])
    .filter((c) =>
      isFillableBlock(c.blockType, FormBlocks[c.blockType]?.blockCategory),
    );
  const totalFieldsAll = allChildrenAll.length;
  const filledFieldsAll = allChildrenAll.filter((c) => {
    const v = formValsRef.current?.[c.id]?.value?.trim();
    return Boolean(v);
  }).length;
  const progressPctAll =
    totalFieldsAll > 0
      ? Math.round((filledFieldsAll / totalFieldsAll) * 100)
      : 0;
  const mascotsAll = resolveProgressMascots(
    (settings as unknown as { progressMascots?: unknown })?.progressMascots,
  );
  const currentMascotAll = getCurrentMascot(mascotsAll, progressPctAll);

  const ProgressHeader = (
    <div className="w-full max-w-[80%] mx-auto flex flex-col gap-1.5 px-1 xl:flex-row xl:items-center xl:justify-between xl:gap-3">
      <span className="text-[11px] xl:text-xs text-muted-foreground/80 shrink-0">
        {stepMode === "off"
          ? `${filledFieldsAll} de ${totalFieldsAll} campos`
          : `Passo ${currentStep + 1} de ${blocks.length}`}
      </span>
      <div className="flex items-center gap-2 flex-1 w-full xl:max-w-[60%]">
        <div className="relative h-1.5 flex-1 rounded-full bg-foreground/10 overflow-visible">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
            style={{
              width: `${progressPctAll}%`,
              backgroundColor: primaryColor || "hsl(var(--primary))",
            }}
          />
          <ProgressMascotIcon
            mascot={currentMascotAll}
            progressPct={progressPctAll}
          />
        </div>
        <span
          className="text-[11px] font-medium tabular-nums shrink-0"
          style={{ color: textColor || undefined }}
          title={`${filledFieldsAll} de ${totalFieldsAll} campos preenchidos`}
        >
          {progressPctAll}%
        </span>
      </div>
    </div>
  );

  if (stepMode === "off") {
    return (
      <>
        {ProgressHeader}
        {blocks.map((block) => {
          const FormBlockComponent = FormBlocks[block.blockType].formComponent;
          return (
            <FormBlockComponent
              key={block.id}
              blockInstance={block}
              handleBlur={wrappedHandleBlur}
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

  const isGroupComplete = (group: FormBlockInstance) => {
    const childs = group.childblocks ?? [];
    if (childs.length === 0) return true;
    for (const child of childs) {
      if (
        !isFillableBlock(
          child.blockType,
          FormBlocks[child.blockType]?.blockCategory,
        )
      )
        continue;

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

  const markGroupReached = (groupId: string | undefined) => {
    if (!groupId) return;
    const existing = formValsRef.current["__groupsReached"] as
      | { meta?: { groups?: string[] } }
      | undefined;
    const prev = Array.isArray(existing?.meta?.groups)
      ? existing!.meta!.groups
      : [];
    if (prev.includes(groupId)) return;
    formValsRef.current["__groupsReached"] = {
      value: "",
      meta: { groups: [...prev, groupId] },
    };
  };

  if (
    stepMode === "auto" &&
    currentStep < blocks.length - 1 &&
    isGroupComplete(blocks[currentStep])
  ) {
    setTimeout(() => {
      markGroupReached(blocks[currentStep + 1]?.id);
      onStepAdvance?.();
      setCurrentStep((s) => Math.min(s + 1, blocks.length - 1));
    }, 0);
  }

  const currentBlock = blocks[currentStep];
  const isLast = currentStep === blocks.length - 1;
  const canAdvance = isGroupComplete(currentBlock);

  if (!currentBlock) return null;

  return (
    <>
      {ProgressHeader}
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

      <div className="w-full max-w-[80%] mx-auto flex flex-col-reverse xl:flex-row justify-between gap-3 xl:gap-4">
        {currentStep > 0 ? (
          <Button
            variant="outline"
            className="w-full xl:w-auto bg-transparent border-primary/20"
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
              className="w-full xl:w-auto bg-transparent border-primary/20"
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
            className="w-full xl:flex-1"
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
              className="w-full xl:flex-1"
              aria-disabled={!canAdvance}
              style={{
                ...primaryBtnStyle,
                opacity: canAdvance ? 1 : 0.5,
                cursor: canAdvance ? undefined : "not-allowed",
              }}
              onClick={() => {
                if (canAdvance) {
                  markGroupReached(blocks[currentStep + 1]?.id);
                  onStepAdvance?.();
                  setCurrentStep((s) => Math.min(s + 1, blocks.length - 1));
                  return;
                }
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
    <div className="w-full max-w-[80%] mx-auto flex flex-col-reverse xl:flex-row justify-between gap-3 xl:gap-4">
      {showLeadFields && (
        <Button
          variant="outline"
          className="w-full xl:w-auto bg-transparent border-primary/20"
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
        className={showLeadFields ? "w-full xl:flex-1" : "w-full"}
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
