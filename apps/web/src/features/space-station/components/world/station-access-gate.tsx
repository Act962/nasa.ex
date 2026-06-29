"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Clock, XCircle, ArrowLeft, Send, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc";

interface Props {
  stationId: string;
  nick:      string;
  accessMode: "OPEN" | "MEMBERS_ONLY" | "REQUEST";
  requestStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  requestedAt: string | null;
  isLoggedIn: boolean;
}

export function StationAccessGate({
  stationId, nick, accessMode, requestStatus, requestedAt, isLoggedIn,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [sentStatus, setSentStatus] = useState<"PENDING" | null>(null);

  const mutation = useMutation({
    ...orpc.spaceStation.requestAccess.mutationOptions(),
    onSuccess: (res) => {
      if (res.status === "MEMBER") {
        toast.success("Você já é membro — entrando");
        router.refresh();
        return;
      }
      toast.success("Pedido enviado ao administrador");
      setSentStatus("PENDING");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar pedido"),
  });

  function submit() {
    if (!isLoggedIn) { router.push(`/sign-in?redirect=/station/${nick}/world`); return; }
    mutation.mutate({ stationId, message: message.trim() || undefined });
  }

  const effectiveStatus = sentStatus ?? requestStatus;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-6 py-10">
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur border border-white/10 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-indigo-300" />
          </div>

          <h1 className="text-white text-xl font-bold mb-1">@{nick}</h1>

          {accessMode === "MEMBERS_ONLY" && (
            <>
              <p className="text-slate-300 text-sm mb-6">
                Esta estação é restrita a membros da organização. Entre em contato com um administrador
                para receber acesso.
              </p>
              <BackButton />
            </>
          )}

          {accessMode === "REQUEST" && effectiveStatus === "PENDING" && (
            <>
              <div className="flex items-center gap-2 text-amber-300 mb-3">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-semibold">Pedido pendente</span>
              </div>
              <p className="text-slate-400 text-xs mb-6">
                {requestedAt ? `Enviado em ${new Date(requestedAt).toLocaleString("pt-BR")}` : "Aguardando aprovação do administrador."}
              </p>
              <BackButton />
            </>
          )}

          {accessMode === "REQUEST" && effectiveStatus === "REJECTED" && (
            <>
              <div className="flex items-center gap-2 text-rose-300 mb-3">
                <XCircle className="h-4 w-4" />
                <span className="text-sm font-semibold">Pedido recusado</span>
              </div>
              <p className="text-slate-400 text-sm mb-6">
                Entre em contato com o administrador para mais informações.
              </p>
              <BackButton />
            </>
          )}

          {accessMode === "REQUEST" && (!effectiveStatus || effectiveStatus === "APPROVED") && (
            <>
              <p className="text-slate-300 text-sm mb-4">
                Esta estação precisa de aprovação para entrar. Envie um pedido ao administrador.
              </p>
              {isLoggedIn ? (
                <>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Mensagem opcional para o administrador..."
                    rows={3}
                    maxLength={500}
                    className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 mb-3"
                  />
                  <Button onClick={submit} disabled={mutation.isPending} className="w-full">
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    {mutation.isPending ? "Enviando..." : "Solicitar acesso"}
                  </Button>
                  <div className="mt-3"><BackButton /></div>
                </>
              ) : (
                <>
                  <Link href={`/sign-in?redirect=/station/${nick}/world`} className="w-full">
                    <Button className="w-full">
                      <LogIn className="h-3.5 w-3.5 mr-1.5" />
                      Entrar para solicitar acesso
                    </Button>
                  </Link>
                  <div className="mt-3"><BackButton /></div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BackButton() {
  return (
    <Link href="/" className="text-slate-400 hover:text-white text-xs flex items-center gap-1 transition-colors">
      <ArrowLeft className="h-3 w-3" /> Voltar
    </Link>
  );
}
