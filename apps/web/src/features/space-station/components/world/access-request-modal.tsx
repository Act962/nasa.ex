"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc";

interface Props {
  stationId: string;
  stationName: string;
  onClose: () => void;
  onRequested?: () => void;
}

export function AccessRequestModal({ stationId, stationName, onClose, onRequested }: Props) {
  const [message, setMessage] = useState("");

  const mutation = useMutation({
    ...orpc.spaceStation.requestAccess.mutationOptions(),
    onSuccess: (res) => {
      if (res.status === "MEMBER") {
        toast.success("Você já é membro — entrando");
      } else {
        toast.success("Pedido enviado ao administrador");
      }
      onRequested?.();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar pedido"),
  });

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-white font-bold">Solicitar acesso</h2>
            <p className="text-slate-400 text-xs">Para entrar em {stationName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="size-4" />
          </button>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Mensagem opcional para o administrador..."
          rows={4}
          maxLength={500}
          className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/60"
        />

        <div className="flex items-center justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate({ stationId, message: message.trim() || undefined })}
            disabled={mutation.isPending}
            className="bg-violet-600 hover:bg-violet-500"
          >
            <Send className="size-3.5 mr-1.5" />
            {mutation.isPending ? "Enviando..." : "Enviar pedido"}
          </Button>
        </div>
      </div>
    </div>
  );
}
