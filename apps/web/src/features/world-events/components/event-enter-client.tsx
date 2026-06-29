"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { client } from "@/lib/orpc";
import { Loader2, AlertTriangle, Sparkles } from "lucide-react";

interface Props {
  slug: string;
  token: string | null;
}

/**
 * Resgata o token e mostra info do evento. A integração full com Phaser
 * + SFU + mesh handoff entra na próxima PR — por agora exibimos os dados
 * retornados pelo `redeemTicket` (mapData, zones, sfu token) num painel
 * "estamos quase lá".
 */
export function EventEnterClient({ slug, token }: Props) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; data: Awaited<ReturnType<typeof client.worldEvents.redeemTicket>> }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({
        kind: "error",
        message:
          "Token de acesso ausente. Volte pra página do evento e clique em 'Entrar'.",
      });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await client.worldEvents.redeemTicket({
          accessToken: token,
        });
        if (!cancelled) setState({ kind: "ready", data });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Erro ao validar ingresso.";
        setState({ kind: "error", message: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.kind === "loading") {
    return (
      <CenterShell>
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        <p className="text-sm text-zinc-400">Validando seu ingresso…</p>
      </CenterShell>
    );
  }

  if (state.kind === "error") {
    return (
      <CenterShell>
        <AlertTriangle className="w-8 h-8 text-amber-400" />
        <h2 className="text-base font-semibold">Não foi possível entrar</h2>
        <p className="text-sm text-zinc-400 max-w-md text-center">
          {state.message}
        </p>
        <Link
          href={`/eventos/${slug}`}
          className="text-sm text-violet-300 hover:underline"
        >
          ← Voltar pra página do evento
        </Link>
      </CenterShell>
    );
  }

  const { data } = state;

  return (
    <CenterShell>
      <div className="flex items-center gap-2 text-violet-300">
        <Sparkles className="w-5 h-5" />
        <span className="text-xs uppercase tracking-wider">Você está dentro</span>
      </div>
      <h1 className="text-2xl font-bold text-center">{data.title}</h1>
      <p className="text-sm text-zinc-400 max-w-md text-center">
        O mapa do mundo está sendo carregado. O renderizador Phaser do
        WorldEvent entra em uma próxima atualização — por enquanto, abaixo está
        o resumo do que foi alocado pra você nessa sessão.
      </p>

      <div className="w-full max-w-md grid grid-cols-1 gap-2 text-xs">
        <Info label="Evento" value={data.title} />
        <Info label="Canal de presença" value={data.presenceChannel} />
        <Info label="Papel no evento" value={data.role} />
        <Info
          label="Palco SFU"
          value={
            data.sfuStageRoom
              ? `${data.sfuStageRoom} (token ${data.sfuStageToken ? "ok" : "—"})`
              : "Não configurado (defina LIVEKIT_API_KEY/SECRET)"
          }
        />
        <Info
          label="Zones"
          value={`${Array.isArray(data.zones) ? data.zones.length : 0} zonas`}
        />
      </div>

      <Link
        href={`/eventos/${slug}`}
        className="text-xs text-zinc-500 hover:underline mt-4"
      >
        ← Voltar
      </Link>
    </CenterShell>
  );
}

function CenterShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-100 px-6 py-12">
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border border-zinc-800 bg-zinc-900/40 rounded-md px-3 py-2">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span className="text-zinc-200 font-mono text-[11px] truncate ml-2">
        {value}
      </span>
    </div>
  );
}
