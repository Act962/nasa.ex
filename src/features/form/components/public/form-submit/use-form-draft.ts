"use client";
import { useEffect, useRef } from "react";
import { FieldValue } from "@/features/form/types";
import { type PrefillFieldMap } from "@/features/form/context/form-prefill-context";
import { normalizePhone } from "@/utils/format-phone";
import { toast } from "sonner";

const LOCAL_DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000;

type SessionContact = {
  name?: string;
  phone?: string;
  ddi?: string;
  email?: string;
};

type PendingLocalDraft = {
  fv: Record<string, FieldValue>;
  contact?: SessionContact;
  responseId?: string | null;
};

type UseFormDraftParams = {
  formId: string;
  initialResponseValues?: Record<string, FieldValue>;
  showLeadFields: boolean;
  formValsRef: React.RefObject<Record<string, FieldValue>>;
  leadInfo: { name: string; phone: string; email: string };
  selectedCountryDdi: string;
  showPhone: boolean;
  showEmail: boolean;
};

export function useFormDraft({
  formId,
  initialResponseValues,
  showLeadFields,
  formValsRef,
  leadInfo,
  selectedCountryDdi,
  showPhone,
  showEmail,
}: UseFormDraftParams) {
  const responseIdStorageKey = `nasa.form.draft.${formId}`;
  const localStorageDraftKey = `nasa.form.ls.${formId}`;

  const responseIdRef = useRef<string | null>(
    typeof window !== "undefined" && !initialResponseValues
      ? sessionStorage.getItem(responseIdStorageKey)
      : null,
  );

  const pendingLocalDraftRef = useRef<PendingLocalDraft | null>(null);

  const saveDraftToLocalStorage = () => {
    if (typeof window === "undefined") return;
    if (initialResponseValues) return;
    // Sem etapa de lead não há telefone/e-mail pra validar identidade no restore — nunca persiste.
    if (!showLeadFields) return;
    try {
      localStorage.setItem(
        localStorageDraftKey,
        JSON.stringify({
          fv: formValsRef.current,
          savedAt: Date.now(),
          contact: {
            name: leadInfo.name,
            phone: leadInfo.phone,
            ddi: selectedCountryDdi,
            email: leadInfo.email,
          },
          // Persistido no localStorage (não só sessionStorage) para sobreviver
          // ao descarte da aba no mobile ao abrir a câmera — assim retomamos o
          // MESMO rascunho no servidor em vez de criar um novo.
          responseId: responseIdRef.current,
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

  // Grava um tombstone no lugar do draft completo, sinalizando que o
  // formulário foi enviado. Na próxima montagem, o restore detecta
  // `submitted: true`, descarta o marcador e não hidrata — evitando
  // pré-preenchimento de respostas já concluídas na mesma aba ou dispositivo.
  const markDraftAsSubmitted = () => {
    if (typeof window === "undefined") return;
    if (initialResponseValues) return;
    try {
      localStorage.setItem(
        localStorageDraftKey,
        JSON.stringify({ submitted: true, savedAt: Date.now() }),
      );
    } catch {
      /* quota ou modo privado — ignorar */
    }
  };

  // Restaura rascunho do localStorage na montagem
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initialResponseValues) return;
    if (!showLeadFields) {
      // Sem telefone/e-mail pra validar identidade: nunca restaura — e descarta
      // qualquer rascunho legado salvo antes dessa trava existir.
      try {
        localStorage.removeItem(localStorageDraftKey);
      } catch {
        /* ignorar */
      }
      return;
    }
    try {
      const raw = localStorage.getItem(localStorageDraftKey);
      if (!raw) return;
      const localDraft = JSON.parse(raw) as {
        fv?: Record<string, FieldValue>;
        savedAt?: number;
        submitted?: boolean;
        contact?: SessionContact;
        responseId?: string | null;
      };
      if (!localDraft.savedAt) return;
      // Formulário já finalizado: tombstone gravado pelo markDraftAsSubmitted.
      // Descarta o marcador e não hidrata — impede pré-preenchimento de respostas concluídas.
      if (localDraft.submitted) {
        localStorage.removeItem(localStorageDraftKey);
        return;
      }
      if (Date.now() - localDraft.savedAt > LOCAL_DRAFT_EXPIRY_MS) {
        localStorage.removeItem(localStorageDraftKey);
        return;
      }
      // Sem contato não há como retomar o step 1 — ignora. `fv` pode estar
      // vazio (passou o step 1 e saiu antes de preencher qualquer campo).
      if (!localDraft.contact) return;
      pendingLocalDraftRef.current = {
        fv: localDraft.fv ?? {},
        contact: localDraft.contact,
        responseId: localDraft.responseId ?? null,
      };
    } catch {
      /* JSON inválido ou localStorage indisponível — ignorar */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Limpa sessionStorage de uploads/assinaturas na montagem
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initialResponseValues) return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (
          key &&
          (key.startsWith("nasa.form.image-upload.") ||
            key.startsWith("nasa.form.signature."))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => sessionStorage.removeItem(key));
    } catch {
      /* sessionStorage indisponível — ignorar */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPendingLocalDraft = (setPrefillMap: (map: PrefillFieldMap) => void) => {
    const pendingDraft = pendingLocalDraftRef.current;
    if (!pendingDraft) return;
    pendingLocalDraftRef.current = null;

    const savedPhone = pendingDraft.contact?.phone ?? "";
    const savedDdi = pendingDraft.contact?.ddi ?? "";
    const savedEmail = pendingDraft.contact?.email ?? "";

    const savedNormalized = normalizePhone(`${savedDdi} ${savedPhone}`);
    const enteredNormalized = normalizePhone(`${selectedCountryDdi} ${leadInfo.phone}`);

    const phoneMatches =
      showPhone && !!savedNormalized && savedNormalized === enteredNormalized;

    const emailMatches =
      !showPhone &&
      showEmail &&
      !!savedEmail &&
      !!leadInfo.email &&
      savedEmail.trim().toLowerCase() === leadInfo.email.trim().toLowerCase();

    if (phoneMatches || emailMatches) {
      const hydratedMap: PrefillFieldMap = {};
      for (const [key, value] of Object.entries(pendingDraft.fv)) {
        if (value && typeof value === "object" && typeof value.value === "string") {
          formValsRef.current[key] = value;
          hydratedMap[key] = value;
        }
      }
      if (Object.keys(hydratedMap).length > 0) {
        setPrefillMap(hydratedMap);
        toast.success("Retomando onde você parou", {
          description: "Suas respostas foram restauradas automaticamente.",
        });
      }
    } else {
      clearLocalStorageDraft();
    }
  };

  const clearSessionDraft = () => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (
          key &&
          (key.startsWith("nasa.form.image-upload.") ||
            key.startsWith("nasa.form.signature.") ||
            key.startsWith("nasa.form.draft."))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => sessionStorage.removeItem(key));
      responseIdRef.current = null;
    } catch {
      /* ignore */
    }
  };

  const persistResponseId = (responseId: string) => {
    responseIdRef.current = responseId;
    try {
      sessionStorage.setItem(responseIdStorageKey, responseId);
    } catch {
      /* private mode / quota — ignore */
    }
    // Persiste o responseId também na sessão do localStorage (sobrevive ao
    // descarte da aba no mobile), pra retomar o mesmo rascunho no servidor.
    saveDraftToLocalStorage();
  };

  const clearResponseId = () => {
    responseIdRef.current = null;
    try {
      sessionStorage.removeItem(responseIdStorageKey);
    } catch {
      /* ignore */
    }
  };

  // Restaura o responseId no resume SEM re-salvar a sessão (diferente de
  // `persistResponseId`): no resume o `leadInfo` ainda não foi hidratado, então
  // um save aqui gravaria contato vazio por cima da sessão boa.
  const hydrateResponseId = (responseId: string) => {
    responseIdRef.current = responseId;
    try {
      sessionStorage.setItem(responseIdStorageKey, responseId);
    } catch {
      /* private mode / quota — ignore */
    }
  };

  return {
    responseIdRef,
    pendingLocalDraftRef,
    saveDraftToLocalStorage,
    clearLocalStorageDraft,
    markDraftAsSubmitted,
    applyPendingLocalDraft,
    clearSessionDraft,
    persistResponseId,
    hydrateResponseId,
    clearResponseId,
  };
}
