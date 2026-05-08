"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { orpc } from "@/lib/orpc";
import { pusherClient } from "@/lib/pusher";

interface SyncMessagesButtonProps {
  conversationId: string;
}

export function SyncMessagesButton({ conversationId }: SyncMessagesButtonProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation(
    orpc.message.syncFromUazapi.mutationOptions({
      onSuccess: () => {
        toast.success("Sincronização iniciada — aguarde alguns segundos.");
        setOpen(false);
      },
      onError: (e: any) =>
        toast.error(e?.message ?? "Falha ao iniciar sincronização"),
    }),
  );

  const handleSync = () => {
    if (!conversationId) return;
    mutation.mutate({ conversationIds: [conversationId] });
  };

  useEffect(() => {
    if (!conversationId) return;
    const channel = pusherClient.subscribe(conversationId);
    const handler = ({ imported }: { imported: number }) => {
      queryClient.invalidateQueries({
        queryKey: ["message.list", conversationId],
      });
      toast.success(
        `Sincronização concluída — ${imported} ${
          imported === 1 ? "mensagem importada" : "mensagens importadas"
        }`,
      );
    };
    channel.bind("messages:synced", handler);
    return () => {
      channel.unbind("messages:synced", handler);
      pusherClient.unsubscribe(conversationId);
    };
  }, [conversationId, queryClient]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          title="Sincronizar mensagens"
          className="gap-2"
        >
          <RefreshCwIcon className="size-4" />
          Sincronizar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sincronizar mensagens</DialogTitle>
          <DialogDescription>
            Vamos buscar o histórico desta conversa direto na sua instância do
            WhatsApp e importar apenas o que ainda não está aqui — sem duplicar
            nada.
          </DialogDescription>
        </DialogHeader>
        <ul className="text-sm space-y-2 list-disc pl-5 text-muted-foreground">
          <li>Roda em segundo plano, sem travar a interface.</li>
          <li>Mensagens já existentes são ignoradas (idempotente por ID).</li>
          <li>
            Mídias antigas (áudio/imagem/arquivo) aparecem como aviso — não são
            baixadas.
          </li>
          <li>Você será notificado aqui mesmo quando terminar.</li>
        </ul>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleSync} disabled={mutation.isPending}>
            {mutation.isPending ? "Iniciando..." : "Sincronizar agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
