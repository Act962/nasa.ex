"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bell, BellOff, Loader2, Send, Monitor } from "lucide-react";
import { client } from "@/lib/orpc";
import { useWebPush } from "../hooks/use-web-push";
import { cn } from "@/lib/utils";

/**
 * Painel de diagnóstico do Web Push (spec 0022).
 *
 * Três botões porque são três falhas distintas, e confundi-las já custou tempo:
 *  1. notificação local  — o Windows/Chrome exibe alguma coisa?
 *  2. ativar             — o browser cria inscrição e o backend grava?
 *  3. enviar do servidor — o push sai, chega e é exibido?
 */
export function PushTestPanel() {
  const {
    availability,
    permission,
    isSubscribed,
    isLoading,
    isPending,
    error,
    subscribe,
    unsubscribe,
  } = useWebPush();

  const [swState, setSwState] = useState<string>("verificando…");
  const [localResult, setLocalResult] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setSwState("sem suporte");
      return;
    }
    navigator.serviceWorker
      .getRegistration("/")
      .then((registration) => {
        if (!registration) return setSwState("não registrado");
        const worker = registration.active ?? registration.installing;
        setSwState(registration.active ? "ativo" : (worker?.state ?? "sem worker"));
      })
      .catch(() => setSwState("erro ao ler"));
  }, [isSubscribed]);

  /** Não passa pelo servidor: isola bloqueio do sistema operacional. */
  async function showLocalNotification() {
    setLocalResult(null);
    try {
      if (Notification.permission !== "granted") {
        const asked = await Notification.requestPermission();
        if (asked !== "granted") {
          setLocalResult(`Permissão: ${asked}. O navegador não vai exibir nada.`);
          return;
        }
      }
      const registration = await navigator.serviceWorker.getRegistration("/");
      if (!registration) {
        setLocalResult("Nenhum Service Worker registrado — ative as notificações primeiro.");
        return;
      }
      await registration.showNotification("Notificação local", {
        body: "Não passou pelo servidor. Se apareceu, o sistema não está bloqueando.",
        icon: "/favicon.png",
        tag: `local:${Date.now()}`,
      });
      setLocalResult("Chamada feita. Se nada apareceu, o bloqueio é do Windows ou do Chrome.");
    } catch (localError) {
      setLocalResult(
        localError instanceof Error ? localError.message : "Falhou.",
      );
    }
  }

  const sendTest = useMutation({
    mutationFn: () => client.push.sendTest({}),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-bold">Teste de notificação</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada botão isola uma etapa. Use de cima para baixo.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border p-4 text-sm">
        <Info label="Suporte" value={availability} />
        <Info label="Permissão" value={permission} />
        <Info label="Service Worker" value={swState} />
        <Info
          label="Inscrito"
          value={isLoading ? "carregando…" : isSubscribed ? "sim" : "não"}
        />
      </section>

      <Step
        number={1}
        title="Notificação local"
        description="Não envolve servidor nem push. Se isto não aparecer, o bloqueio é do sistema."
      >
        <button
          type="button"
          onClick={showLocalNotification}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition hover:bg-accent"
        >
          <Monitor className="size-4" />
          Mostrar notificação local
        </button>
        {localResult && <Result>{localResult}</Result>}
      </Step>

      <Step
        number={2}
        title="Ativar notificações"
        description="Pede permissão, registra o Service Worker e grava a inscrição no banco."
      >
        <button
          type="button"
          onClick={() => (isSubscribed ? unsubscribe() : subscribe())}
          disabled={isPending || isLoading || availability !== "ready"}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isSubscribed
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "hover:bg-accent",
          )}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isSubscribed ? (
            <Bell className="size-4" />
          ) : (
            <BellOff className="size-4" />
          )}
          {isSubscribed ? "Notificações ativas — desativar" : "Ativar notificações"}
        </button>
        {availability !== "ready" && !isLoading && (
          <Result>
            Indisponível: <strong>{availability}</strong>
            {availability === "no-vapid-key" &&
              " — falta NEXT_PUBLIC_VAPID_PUBLIC_KEY no bundle."}
            {availability === "insecure-context" &&
              " — precisa de HTTPS ou localhost."}
          </Result>
        )}
        {error && <Result tone="error">{error}</Result>}
      </Step>

      <Step
        number={3}
        title="Enviar push pelo servidor"
        description="Percorre o caminho real: NotificationService → web-push → FCM → Service Worker."
      >
        <button
          type="button"
          onClick={() => sendTest.mutate()}
          disabled={sendTest.isPending || !isSubscribed}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sendTest.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Enviar push de teste
        </button>

        {!isSubscribed && <Result>Ative as notificações no passo 2 primeiro.</Result>}

        {sendTest.data && (
          <Result tone={sendTest.data.sent > 0 ? "ok" : "error"}>
            Aceitos pelo push service: <strong>{sendTest.data.sent}</strong> ·
            falhas: <strong>{sendTest.data.failed}</strong>
            {sendTest.data.skipped && " · canal pulado"}
            {sendTest.data.reason && ` · ${sendTest.data.reason}`}
            {sendTest.data.sent > 0 &&
              " — o servidor entregou. Se nada apareceu na tela, o bloqueio é do sistema."}
          </Result>
        )}
        {sendTest.error && (
          <Result tone="error">{sendTest.error.message}</Result>
        )}
      </Step>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs font-medium">{value}</span>
    </div>
  );
}

function Step({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Passo {number}
      </p>
      <h2 className="mt-0.5 font-semibold">{title}</h2>
      <p className="mt-1 mb-3 text-sm text-muted-foreground">{description}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Result({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "ok" | "error";
}) {
  return (
    <p
      className={cn(
        "text-xs leading-relaxed",
        tone === "error" && "text-red-500",
        tone === "ok" && "text-emerald-600 dark:text-emerald-400",
        tone === "info" && "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}
