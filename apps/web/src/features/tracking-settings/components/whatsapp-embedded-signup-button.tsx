"use client";

import Script from "next/script";
import { Loader2, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useEmbeddedSignup } from "../hooks/use-embedded-signup";

/**
 * Botão "Conectar via Meta" — Fase 7 do Roadmap WhatsApp Oficial.
 *
 * Gate: presença de `NEXT_PUBLIC_META_APP_ID` + `NEXT_PUBLIC_META_LOGIN_
 * CONFIG_ID`. Sem essas, o componente retorna `null` — em prod a feature
 * fica oculta até as envs serem setadas no deploy (estratégia documentada
 * na decisão #8 do plano Fase 7).
 *
 * SDK do Facebook é carregado via `next/script strategy="afterInteractive"`
 * (mesmo padrão de `tracking-scripts.tsx` pra Facebook Pixel). O FB.init
 * roda no `fbAsyncInit` definido em window pelo `Script onLoad`.
 */

const FB_SDK_URL = "https://connect.facebook.net/en_US/sdk.js";

export function WhatsAppEmbeddedSignupButton({
  trackingId,
  onSuccess,
}: {
  trackingId: string;
  onSuccess?: () => void;
}) {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_LOGIN_CONFIG_ID;

  if (!appId || !configId) {
    // Gate por envs (decisão #8 do plano). Sem ambas, esconde a UI.
    return null;
  }

  return (
    <EmbeddedSignupReady
      trackingId={trackingId}
      appId={appId}
      configId={configId}
      onSuccess={onSuccess}
    />
  );
}

function EmbeddedSignupReady({
  trackingId,
  appId,
  configId,
  onSuccess,
}: {
  trackingId: string;
  appId: string;
  configId: string;
  onSuccess?: () => void;
}) {
  const { launchSignup, isLaunching, isCompleting } = useEmbeddedSignup({
    trackingId,
    appId,
    configId,
    onSuccess,
  });

  const busy = isLaunching || isCompleting;

  return (
    <>
      <Script
        id="fb-sdk"
        strategy="afterInteractive"
        src={FB_SDK_URL}
        async
        defer
        crossOrigin="anonymous"
      />
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2.5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2 mt-0.5">
            <MessageSquare className="size-4 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold">Conectar via Meta</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Fluxo oficial: faça login com sua conta Meta, escolha a WABA
              e o número, e a NASA recebe as credenciais automaticamente
              (sem colar token manualmente).
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={launchSignup}
            disabled={busy}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {busy && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
            {isCompleting
              ? "Finalizando..."
              : isLaunching
                ? "Aguardando Meta..."
                : "Conectar via Meta"}
          </Button>
        </div>
      </div>
    </>
  );
}
