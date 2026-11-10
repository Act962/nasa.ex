"use client";

import { useState } from "react";
import { CircleCheck, ShieldOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

/** Tela de Permitir das IAs conectadas por OAuth (spec 0135, RF-6, D-4). */

interface ConnectAiScreenProps {
  connectRequest: { signedQuery: string; clientName: string | null; returnDomain: string | null } | null;
  account: { name: string; email: string };
  appLabels: string[];
  switchAccountHref: string;
}

const UNNAMED_AI = "Uma IA";

async function answerConsent(signedQuery: string, isAccepted: boolean) {
  const response = await fetch("/api/auth/oauth2/consent", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accept: isAccepted, oauth_query: signedQuery }),
  });
  const responseBody = (await response.json().catch(() => null)) as { url?: string; redirect_uri?: string } | null;
  const nextUrl = responseBody?.url ?? responseBody?.redirect_uri;
  if (!response.ok || !nextUrl) throw new Error("Não deu para registrar a resposta. Peça para a IA conectar de novo.");
  window.location.assign(nextUrl);
}

export function ConnectAiScreen({ connectRequest, account, appLabels, switchAccountHref }: ConnectAiScreenProps) {
  const [isBusy, setIsBusy] = useState(false);

  if (!connectRequest) {
    return (
      <div className="w-full max-w-md rounded-2xl bg-white/5 p-6 text-white">
        <h1 className="text-xl font-bold">Este pedido de conexão não é válido.</h1>
        <p className="mt-2 text-sm text-white/70">Ele foi alterado ou expirou. Volte para a sua IA e peça para conectar o ÓRBITA de novo.</p>
        <a href="/home" className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
          Ir para o início
        </a>
      </div>
    );
  }

  const aiName = connectRequest.clientName?.trim() || UNNAMED_AI;
  const run = (action: () => Promise<void>) => async () => {
    setIsBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Algo deu errado.");
      setIsBusy(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl bg-white/5 p-6 text-white">
      <h1 className="text-xl leading-snug font-bold">{aiName} quer acessar sua conta do ÓRBITA</h1>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{account.name}</p>
          <p className="truncate text-sm text-white/60">{account.email}</p>
        </div>
        <button
          type="button"
          disabled={isBusy}
          onClick={run(async () => {
            await authClient.signOut();
            window.location.assign(switchAccountHref);
          })}
          className="shrink-0 text-sm text-white/80 underline-offset-4 hover:underline"
        >
          Usar outra conta
        </button>
      </div>

      <div className="mt-5 space-y-2 text-sm">
        <p className="font-semibold">A IA poderá, em todas as empresas em que você tem acesso:</p>
        {appLabels.length === 0 ? (
          <p className="text-white/70">Nenhum app ainda: esta conta não tem o Planner liberado em nenhuma empresa.</p>
        ) : (
          <ul className="space-y-1.5">
            {appLabels.map((appLabel) => (
              <li key={appLabel} className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-success" />
                <span>Usar o {appLabel} com as mesmas permissões que você tem nas telas</span>
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-start gap-2 text-white/70">
          <ShieldOff className="mt-0.5 size-4 shrink-0" />
          <span>Ela não aprova, não programa e não publica posts, e não troca a sua senha.</span>
        </p>
        {connectRequest.returnDomain && (
          <p className="flex items-start gap-2 text-white/70">
            <CircleCheck className="mt-0.5 size-4 shrink-0" />
            <span>Depois, você volta para {connectRequest.returnDomain}.</span>
          </p>
        )}
        <p className="text-xs text-white/50">Você pode desconectar quando quiser em Satélites → IA externa.</p>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          disabled={isBusy}
          onClick={run(() => answerConsent(connectRequest.signedQuery, false))}
          className="rounded-full border border-white/20 px-4 py-2 text-sm disabled:opacity-40"
        >
          Recusar
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={run(() => answerConsent(connectRequest.signedQuery, true))}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
        >
          {isBusy ? "Conectando…" : "Permitir"}
        </button>
      </div>
    </div>
  );
}
