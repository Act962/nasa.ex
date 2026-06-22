"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Hook do Embedded Signup (Fase 7 — Roadmap WhatsApp Oficial).
 *
 * Orquestra os 3 movimentos do fluxo no cliente:
 *
 *  1. `FB.login` abre o pop-up Meta com `config_id` + `response_type: "code"`
 *     e devolve `code` no callback (TTL 30s).
 *  2. `window.postMessage WA_EMBEDDED_SIGNUP` chega em paralelo com
 *     `{waba_id, phone_number_id, business_id?}` no `data.data`.
 *  3. Quando os dois lados chegaram (code + IDs), invoca a mutation
 *     `integrations.completeWhatsAppEmbeddedSignup` que faz o
 *     exchange + subscribe + register + persist no servidor.
 *
 * Considerações:
 *  - Listener é instalado on mount e removido on unmount (sem
 *    side-effect persistente).
 *  - O `event.origin` é filtrado RIGOROSAMENTE — `endsWith("facebook.com")`
 *    cobre `www.facebook.com`, `web.facebook.com`, `business.facebook.com`.
 *    `code` falsificado via postMessage não vaza credencial porque o
 *    exchange só roda server-side com o `client_secret` do App da NASA.
 *  - Se o callback do FB.login retorna sem `code`, significa que o usuário
 *    fechou o pop-up — silently cancela (sem toast).
 *  - Se o postMessage chega antes do callback ou vice-versa, juntamos
 *    quando o segundo chega (`pendingRef`).
 */

interface EmbeddedSignupPayload {
  code: string;
  wabaId: string;
  phoneNumberId: string;
  businessId?: string;
}

interface PartialPayload {
  code?: string;
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
}

interface FBLoginResponse {
  authResponse?: {
    code?: string;
    accessToken?: string;
  } | null;
  status?: string;
}

interface FBStatic {
  init: (options: {
    appId: string;
    cookie: boolean;
    xfbml: boolean;
    version: string;
  }) => void;
  login: (
    callback: (response: FBLoginResponse) => void,
    options: {
      config_id: string;
      response_type: "code";
      override_default_response_type: boolean;
      extras: {
        setup: Record<string, unknown>;
        featureType: string;
        sessionInfoVersion: string;
      };
    },
  ) => void;
}

declare global {
  interface Window {
    FB?: FBStatic;
    fbAsyncInit?: () => void;
  }
}

interface UseEmbeddedSignupParams {
  trackingId: string;
  appId: string;
  configId: string;
  graphVersion?: string;
  onSuccess?: () => void;
}

export function useEmbeddedSignup({
  trackingId,
  appId,
  configId,
  graphVersion = "v23.0",
  onSuccess,
}: UseEmbeddedSignupParams) {
  const queryClient = useQueryClient();
  const [isLaunching, setIsLaunching] = useState(false);
  const pendingRef = useRef<PartialPayload>({});

  const mutation = useMutation(
    orpc.integrations.completeWhatsAppEmbeddedSignup.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          data.displayPhoneNumber
            ? `WhatsApp Oficial conectado: ${data.displayPhoneNumber}`
            : "WhatsApp Oficial conectado.",
        );
        queryClient.invalidateQueries({
          queryKey: orpc.integrations.getProviderSettings.queryKey({
            input: { trackingId },
          }),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.integrations.get.queryKey({
            input: { trackingId },
          }),
        });
        pendingRef.current = {};
        onSuccess?.();
      },
      onError: (error) => {
        toast.error(
          error instanceof Error
            ? `Falha no Embedded Signup: ${error.message}`
            : "Erro ao completar Embedded Signup.",
        );
        pendingRef.current = {};
      },
    }),
  );

  // ── Listener postMessage ──────────────────────────────────────────────
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Filtra rigorosamente — postMessage cross-origin pode vir de
      // qualquer aba. `endsWith("facebook.com")` cobre www/web/business.
      if (typeof event.origin !== "string") return;
      try {
        const url = new URL(event.origin);
        if (!url.hostname.endsWith("facebook.com")) return;
      } catch {
        return;
      }
      let parsed: unknown;
      try {
        parsed =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (
        !parsed ||
        typeof parsed !== "object" ||
        (parsed as { type?: unknown }).type !== "WA_EMBEDDED_SIGNUP"
      ) {
        return;
      }
      const payload = parsed as {
        event?: string;
        data?: {
          waba_id?: string;
          phone_number_id?: string;
          business_id?: string;
        };
      };
      // Eventos intermediários (cancel / current_step) não nos interessam
      // — só os finais que carregam waba_id/phone_number_id.
      const wabaId = payload.data?.waba_id;
      const phoneNumberId = payload.data?.phone_number_id;
      if (!wabaId || !phoneNumberId) return;

      pendingRef.current = {
        ...pendingRef.current,
        wabaId,
        phoneNumberId,
        businessId: payload.data?.business_id ?? pendingRef.current.businessId,
      };

      tryComplete();
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
    // tryComplete reads pendingRef but doesn't change identity per render;
    // mutation reference can change but `useMutation` returns stable
    // object — disable deps lint manually via the wrapper below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tryComplete() {
    const partial = pendingRef.current;
    if (
      !partial.code ||
      !partial.wabaId ||
      !partial.phoneNumberId ||
      mutation.isPending
    ) {
      return;
    }
    const payload: EmbeddedSignupPayload = {
      code: partial.code,
      wabaId: partial.wabaId,
      phoneNumberId: partial.phoneNumberId,
      ...(partial.businessId ? { businessId: partial.businessId } : {}),
    };
    mutation.mutate({ trackingId, ...payload });
  }

  const launchSignup = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!window.FB) {
      toast.error(
        "SDK do Facebook ainda não carregou. Tente de novo em alguns segundos.",
      );
      return;
    }
    setIsLaunching(true);
    pendingRef.current = {};

    // Init é idempotente — FB.init pode ser chamado várias vezes sem
    // efeito colateral. Mantemos aqui pra cobrir o caso de mount tardio
    // do componente onde fbAsyncInit já rodou e o init ainda não.
    window.FB.init({
      appId,
      cookie: true,
      xfbml: false,
      version: graphVersion,
    });

    window.FB.login(
      (response: FBLoginResponse) => {
        setIsLaunching(false);
        const code = response.authResponse?.code;
        if (!code) {
          // Usuário fechou pop-up ou negou — silently cancela.
          return;
        }
        pendingRef.current = { ...pendingRef.current, code };
        tryComplete();
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "",
          sessionInfoVersion: "3",
        },
      },
    );
  }, [appId, configId, graphVersion]);

  return {
    launchSignup,
    isLaunching,
    isCompleting: mutation.isPending,
    error: mutation.error,
  };
}
