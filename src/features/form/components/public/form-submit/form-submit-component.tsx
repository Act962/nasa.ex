"use client";
import { useEffect, useRef, useState } from "react";
import {
  FieldValue,
  FormBlockInstance,
  HandleBlurFunc,
} from "@/features/form/types";
import {
  FormPrefillProvider,
  type PrefillFieldMap,
} from "@/features/form/context/form-prefill-context";
import { toast } from "sonner";
import {
  useMutationSubmitResponse,
  useMutationSavePartialResponse,
  useMutationValidateLeadPhone,
  useMutationFindDraftByPhone,
  useMutationCheckExistingLead,
} from "../../../hooks/use-form";
import { authClient } from "@/lib/auth-client";
import { getTrackingParamsClient } from "@/lib/tracking/tracking-params";
import { Card, CardContent } from "@/components/ui/card";
import { FormSettings } from "@/generated/prisma/client";
import type { FormSettingsTyped } from "@/features/form/types";
import { getContrastColor } from "@/utils/get-contrast-color";
import { cn } from "@/lib/utils";
import { normalizePhone } from "@/utils/format-phone";
import { countries } from "@/types/some";
import { normalizeRedirectUrl } from "@/features/form/lib/normalize-redirect-url";
import { resolveNextButtonAction } from "@/features/form/lib/next-button-action";
import { useLeadInfo } from "./use-lead-info";
import { useFormDraft } from "./use-form-draft";
import { LeadStep } from "./lead-step";
import { StepBlocks } from "./step-blocks";

export type ExistingLeadHint = {
  exists: boolean;
  currentTrackingName?: string | null;
  currentStatusName?: string | null;
  isInFormTracking?: boolean;
};

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
  const findDraft = useMutationFindDraftByPhone();
  const validateLeadPhone = useMutationValidateLeadPhone();
  const checkExistingLead = useMutationCheckExistingLead();

  // Mod 1: sinaliza (só pra consultor autenticado) que o telefone já é um lead
  // da org. Visitante anônimo não tem sessão → nunca consulta nem vê o selo.
  const { data: sessionData } = authClient.useSession();
  const viewerIsAuthenticated = !!sessionData?.user;
  const [existingLeadHint, setExistingLeadHint] =
    useState<ExistingLeadHint | null>(null);

  const [resumeLoading, setResumeLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setSubmitted] = useState(false);

  const [prefillMap, setPrefillMap] = useState<PrefillFieldMap>(() => {
    if (!initialResponseValues) return {};
    const map: PrefillFieldMap = {};
    for (const [key, value] of Object.entries(initialResponseValues)) {
      if (value && typeof value === "object" && typeof value.value === "string") {
        map[key] = value;
      }
    }
    return map;
  });

  const formVals = useRef<Record<string, FieldValue>>(
    initialResponseValues ? { ...initialResponseValues } : {},
  );
  const savingPartialRef = useRef(false);
  const dbSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Após o submit, nenhum autosave atrasado pode regravar o rascunho por cima
  // do tombstone "já enviado" — senão o resume ressuscita uma resposta já
  // finalizada e o próximo submit manda um responseId obsoleto.
  const submittedRef = useRef(false);
  const sessionKeyRef = useRef<string>(`form-${id}-${Date.now()}`);

  const showName = settings?.showName ?? true;
  const showEmail = settings?.showEmail ?? true;
  const showPhone = settings?.showPhone ?? true;
  const needLogin = settings?.needLogin ?? true;
  const finishMessage = settings?.finishMessage ?? "Obrigado por seu cadastro!";
  const primaryColor = settings?.primaryColor ?? undefined;
  const backgroundColor = settings?.backgroundColor ?? undefined;
  const backgroundImage = settings?.backgroundImage ?? undefined;
  const redirectUrl = settings?.redirectUrl ?? undefined;
  // Opt-in (default off): sem isso o form nunca guarda nem retoma sessão.
  const resumeSession =
    (settings as { resumeSession?: boolean } | null | undefined)
      ?.resumeSession ?? false;

  const isEditMode = !!onSubmitOverride;
  const showLeadFields =
    !isEditMode && needLogin && (showName || showEmail || showPhone);

  const [step, setStep] = useState(showLeadFields ? 1 : 2);
  const textColor = backgroundColor ? getContrastColor(backgroundColor) : undefined;

  const {
    leadInfo,
    setLeadInfo,
    setName,
    setEmail,
    setPhone,
    selectedCountry,
    setSelectedCountry,
  } = useLeadInfo({ initialLead });

  const draft = useFormDraft({
    formId: id,
    initialResponseValues,
    showLeadFields,
    resumeEnabled: resumeSession,
    formValsRef: formVals,
    leadInfo,
    selectedCountryDdi: selectedCountry.ddi,
    showPhone,
    showEmail,
  });

  useEffect(() => {
    return () => {
      if (dbSaveDebounceRef.current) clearTimeout(dbSaveDebounceRef.current);
    };
  }, []);

  // Retoma a sessão salva (nome/telefone/respostas) sem refazer o step 1 — cobre
  // o tablet que descarta a aba ao abrir a câmera. TTL de 24h e limpeza no submit
  // vivem no useFormDraft; aqui só reidratamos e pulamos pro corpo do form.
  const autoResumedRef = useRef(false);
  useEffect(() => {
    if (autoResumedRef.current) return;
    if (initialResponseValues || !showLeadFields || !resumeSession) return;
    const session = draft.pendingLocalDraftRef.current;
    if (!session?.contact) return;
    autoResumedRef.current = true;
    draft.pendingLocalDraftRef.current = null;

    const contact = session.contact;
    setLeadInfo({
      name: contact.name ?? "",
      phone: contact.phone ?? "",
      email: contact.email ?? "",
    });
    if (contact.ddi) {
      const country = countries.find((item) => item.ddi === contact.ddi);
      if (country) setSelectedCountry(country);
    }

    const hydrated: PrefillFieldMap = {};
    for (const [key, value] of Object.entries(session.fv ?? {})) {
      if (value && typeof value === "object" && typeof value.value === "string") {
        formVals.current[key] = value;
        hydrated[key] = value;
      }
    }
    if (Object.keys(hydrated).length > 0) setPrefillMap(hydrated);

    if (session.responseId) draft.hydrateResponseId(session.responseId);

    setStep(2);
    toast.success("Retomando de onde você parou", {
      description: "Seus dados e respostas foram restaurados.",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mod 1: ao digitar o telefone (consultor autenticado), checa de forma
  // discreta se já existe lead na base. Debounced; ignora resultados obsoletos.
  useEffect(() => {
    if (!viewerIsAuthenticated || !showPhone || isEditMode) {
      setExistingLeadHint(null);
      return;
    }
    const digits = leadInfo.phone.replace(/\D/g, "");
    if (digits.length < 8) {
      setExistingLeadHint(null);
      return;
    }
    let cancelled = false;
    const phoneNormalized = normalizePhone(
      `${selectedCountry.ddi} ${leadInfo.phone}`,
    );
    const timer = setTimeout(async () => {
      try {
        const result = await checkExistingLead.mutateAsync({
          formId: id,
          phone: phoneNormalized,
        });
        if (!cancelled) setExistingLeadHint(result);
      } catch {
        if (!cancelled) setExistingLeadHint(null);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    leadInfo.phone,
    selectedCountry.ddi,
    viewerIsAuthenticated,
    showPhone,
    isEditMode,
    id,
  ]);

  const isFieldFilled = (fieldValue: FieldValue | undefined): boolean => {
    if (!fieldValue) return false;
    const val = fieldValue.value as unknown;
    if (val == null) return false;
    if (typeof val === "string") return val.trim().length > 0;
    if (typeof val === "number") return !Number.isNaN(val);
    if (typeof val === "boolean") return val;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "object") return Object.keys(val).length > 0;
    return false;
  };

  const validateLeadFields = () => {
    const errors: Record<string, string> = {};
    if (needLogin) {
      if (showName && !leadInfo.name.trim()) errors["lead_name"] = "Nome é obrigatório";
      if (showEmail && !leadInfo.email.trim()) errors["lead_email"] = "E-mail é obrigatório";
      if (showPhone && !leadInfo.phone.trim()) errors["lead_phone"] = "Telefone é obrigatório";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateFormBlocks = () => {
    const errors: Record<string, string> = {};
    const walkBlock = (block: FormBlockInstance) => {
      if (block.attributes?.required) {
        const fieldValue = formVals.current?.[block.id];
        if (!isFieldFilled(fieldValue)) {
          errors[block.id] = "Este campo é obrigatório";
        }
      }
      // CEP com validação de existência ligada: só passa se o ViaCEP confirmou
      // (meta.cepExists === true). Barra CEP inexistente ou ainda não verificado.
      if (
        block.blockType === "MaskedField" &&
        block.attributes?.format === "cep" &&
        block.attributes?.validateCep
      ) {
        const fieldValue = formVals.current?.[block.id];
        if (isFieldFilled(fieldValue) && fieldValue?.meta?.cepExists !== true) {
          errors[block.id] = "CEP não encontrado ou não validado";
        }
      }
      // CPF com validação ligada: só passa se o dígito verificador bate
      // (meta.cpfExists === true). Barra CPF inválido, independente de `required`.
      if (
        block.blockType === "MaskedField" &&
        block.attributes?.format === "cpf" &&
        block.attributes?.validateCpf
      ) {
        const fieldValue = formVals.current?.[block.id];
        if (isFieldFilled(fieldValue) && fieldValue?.meta?.cpfExists !== true) {
          errors[block.id] = "CPF inválido";
        }
      }
      block.childblocks?.forEach(walkBlock);
    };
    blocks.forEach(walkBlock);
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const persistPartial = async () => {
    if (submittedRef.current) return;
    // Sem permissão de edição, navegar entre etapas não pode gerar requisição
    // nenhuma — o servidor devolveria 403 a cada "Próximo" (spec 0005, RF-11).
    if (readOnly) return;
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
            user_phone: normalizePhone(`${selectedCountry.ddi} ${leadInfo.phone}`),
          }),
        }),
      });

      if (onPartialSave) {
        const result = await onPartialSave(responseJson, draft.responseIdRef.current);
        if (result?.responseId) {
          draft.responseIdRef.current = result.responseId;
        }
        return;
      }

      const tracking = getTrackingParamsClient();
      const result = await savePartialResponse.mutateAsync({
        id,
        response: responseJson,
        tracking,
        ...(draft.responseIdRef.current ? { responseId: draft.responseIdRef.current } : {}),
      });
      if (result?.responseId) {
        draft.persistResponseId(result.responseId);
      }
    } catch (error) {
      // NOT_FOUND aqui = o responseId já não é elegível pra autosave (ex:
      // resposta já foi completada por outra aba/retry, ver save-partial-response.ts).
      // Limpa o id morto pra parar de tentar salvar nele a cada blur.
      const code = (error as { code?: string } | null)?.code;
      if (code === "NOT_FOUND") {
        draft.clearResponseId();
      }
      console.warn("[form] auto-save falhou", error);
    } finally {
      savingPartialRef.current = false;
    }
  };

  const handleBlur: HandleBlurFunc = (key, value) => {
    formVals.current[key] = { value: value.value, meta: value.meta };
    if (formErrors[key] && isFieldFilled({ value: value.value, meta: value.meta })) {
      setFormErrors((previous) => {
        const updated = { ...previous };
        delete updated[key];
        return updated;
      });
    }
    if (submittedRef.current) return;
    draft.saveDraftToLocalStorage();
    if (dbSaveDebounceRef.current) clearTimeout(dbSaveDebounceRef.current);
    dbSaveDebounceRef.current = setTimeout(() => {
      void persistPartial();
    }, 1500);
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
          user_phone: normalizePhone(`${selectedCountry.ddi} ${leadInfo.phone}`),
        }),
      }),
    });
    const tracking = getTrackingParamsClient();

    if (onSubmitOverride) {
      try {
        await onSubmitOverride(responseJson);
      } catch {
        // Override já mostra toast de erro; só liberamos o botão
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const nextAction = resolveNextButtonAction(
      (settings as { nextButtonAction?: unknown } | null | undefined)?.nextButtonAction,
    );

    submitResponse.mutate(
      {
        id,
        response: responseJson,
        tracking,
        ...(draft.responseIdRef.current ? { responseId: draft.responseIdRef.current } : {}),
        ...(nextAction.type === "add_tag" && nextAction.tagId
          ? { nextActionTagId: nextAction.tagId }
          : {}),
      },
      {
        onSuccess: () => {
          submittedRef.current = true;
          if (dbSaveDebounceRef.current) {
            clearTimeout(dbSaveDebounceRef.current);
            dbSaveDebounceRef.current = null;
          }
          setSubmitted(true);
          draft.markDraftAsSubmitted();
          draft.clearSessionDraft();
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

  const handleContinue = async () => {
    if (!validateLeadFields()) {
      toast("Campos obrigatórios não preenchidos");
      return;
    }
    draft.clearResponseId();

    if (showPhone && leadInfo.phone.trim() && !onSubmitOverride) {
      setResumeLoading(true);
      try {
        const phoneNormalized = normalizePhone(`${selectedCountry.ddi} ${leadInfo.phone}`);
        const { result } = await validateLeadPhone.mutateAsync({
          formId: id,
          phone: phoneNormalized,
        });
        if (result.status === "invalid") {
          setFormErrors({ lead_phone: "Número de telefone inválido" });
          toast.error("O telefone informado não é um número válido.");
          setResumeLoading(false);
          return;
        }
      } catch (error) {
        console.warn("[form] validateLeadPhone failed", error);
      } finally {
        setResumeLoading(false);
      }
    }

    if (resumeSession && showPhone && leadInfo.phone.trim() && !onSubmitOverride) {
      setResumeLoading(true);
      try {
        const phoneNormalized = normalizePhone(`${selectedCountry.ddi} ${leadInfo.phone}`);
        const result = await findDraft.mutateAsync({ formId: id, phone: phoneNormalized });
        const latestResponse = result.response;

        if (latestResponse?.completedAt) {
          // Resposta mais recente desse lead pra esse form já foi enviada —
          // não hidrata nem daqui nem do rascunho local (mesma lógica do
          // tombstone do `use-form-draft`: depois de enviar, nunca mais
          // auto-hidrata). Cobre o caso em que o ack do submit anterior se
          // perdeu e o rascunho local ficou "vivo" sem o tombstone.
          draft.clearLocalStorageDraft();
          draft.pendingLocalDraftRef.current = null;
        } else if (latestResponse) {
          let parsed: Record<string, unknown> = {};
          try {
            parsed =
              typeof latestResponse.jsonResponse === "string"
                ? JSON.parse(latestResponse.jsonResponse)
                : (latestResponse.jsonResponse as Record<string, unknown>);
          } catch {
            /* ignore parse error */
          }
          const hydrated: PrefillFieldMap = {};
          for (const [key, value] of Object.entries(parsed)) {
            if (
              value &&
              typeof value === "object" &&
              "value" in (value as Record<string, unknown>) &&
              typeof (value as { value?: unknown }).value === "string"
            ) {
              hydrated[key] = value as { value: string; meta?: Record<string, unknown> };
              formVals.current[key] = hydrated[key] as { value: string; meta?: Record<string, unknown> };
            }
          }
          if (Object.keys(hydrated).length > 0) {
            setPrefillMap(hydrated);
            draft.persistResponseId(latestResponse.responseId);
            draft.clearLocalStorageDraft();
            draft.pendingLocalDraftRef.current = null;
            toast.success("Continuando rascunho salvo", {
              description: "Os campos preenchidos antes foram restaurados.",
            });
          }
        }
      } catch (error) {
        console.warn("[form] findDraft failed", error);
      } finally {
        setResumeLoading(false);
      }
    }

    draft.applyPendingLocalDraft(setPrefillMap);
    // Persiste a sessão (nome/telefone) já ao entrar no corpo do form, antes de
    // qualquer blur — cobre o caso de tocar a foto logo após o step 1.
    draft.saveDraftToLocalStorage();
    setStep(2);
  };

  const primaryBtnStyle: React.CSSProperties = {
    backgroundColor: primaryColor || undefined,
    borderColor: primaryColor || undefined,
    color: primaryColor ? getContrastColor(primaryColor) : undefined,
  };

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
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
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
                    backgroundImage ? "bg-white/20 backdrop-blur-md" : "bg-foreground/10",
                  )}
                  style={{ color: textColor || undefined }}
                >
                  <CardContent className="px-2 pb-2">
                    <div className="py-4 px-3">
                      <h1 className="text-4xl font-normal">{finishMessage}</h1>
                      <p className="mt-2 mb-8 text-base">Recebemos seu formulário</p>
                      {redirectUrl && (
                        <p
                          className={textColor ? "text-sm" : "text-sm text-muted-foreground"}
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
                      <LeadStep
                        showName={showName}
                        showEmail={showEmail}
                        showPhone={showPhone}
                        leadInfo={leadInfo}
                        selectedCountry={selectedCountry}
                        formErrors={formErrors}
                        resumeLoading={resumeLoading}
                        textColor={textColor}
                        primaryBtnStyle={primaryBtnStyle}
                        onNameChange={setName}
                        onEmailChange={setEmail}
                        onPhoneChange={setPhone}
                        onCountryChange={setSelectedCountry}
                        onContinue={handleContinue}
                        existingLeadHint={existingLeadHint}
                      />
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
                        readOnly={readOnly}
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
