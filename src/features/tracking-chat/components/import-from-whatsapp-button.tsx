"use client";

/**
 * Botão "Importar conversas existentes do WhatsApp".
 *
 * Quando clicado, dispara a procedure `conversation.importExistingChats`
 * que puxa os chats da uazapi via `/chat/find` e cria Lead+Conversation
 * pra cada um. **Safe contra ban**: apenas leitura, mesma operação que
 * o WhatsApp Web faz quando você abre — sem outbound, com throttle.
 *
 * UX:
 *  - Loading state com Spinner
 *  - Toast no fim com `imported`, `skipped`
 *  - Se `hasMore: true`, mostra "Importar mais" como follow-up (offset
 *    persistido em state local até o usuário fechar a tela)
 *  - Invalida queries de conversations.list pra UI atualizar
 *
 * Custo: 5★ por batch (até 50 chats). Action `chat_import_existing`.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DownloadIcon, Loader2 } from "lucide-react";

interface ImportFromWhatsAppButtonProps {
  trackingId: string;
  /** Variant do botão pra encaixar em diferentes contextos (Empty vs Dialog). */
  variant?: "default" | "outline" | "ghost";
  /** Texto opcional — default "Importar do WhatsApp". */
  label?: string;
}

export function ImportFromWhatsAppButton({
  trackingId,
  variant = "outline",
  label = "Importar do WhatsApp",
}: ImportFromWhatsAppButtonProps) {
  const qc = useQueryClient();
  // `offset` persiste enquanto o componente está montado — usuário pode
  // clicar várias vezes pra paginar. Reseta ao desmontar (próxima vez
  // que o Empty aparecer começa do zero, o que é OK porque importações
  // anteriores ficam idempotentes via remoteJid).
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const mutation = useMutation(
    orpc.conversation.importExistingChats.mutationOptions({
      onSuccess: (data: any) => {
        const {
          imported,
          skipped,
          hasMore: more,
          nextOffset,
          messageSyncQueued,
        } = data;
        if (imported === 0 && skipped === 0) {
          toast.info(
            "Nenhuma conversa pra importar — sua instância pode estar vazia ou todas já foram importadas.",
          );
        } else {
          const parts: string[] = [`${imported} conversa(s) importada(s)`];
          if (skipped > 0) parts.push(`${skipped} já existia(m)`);
          if (messageSyncQueued > 0) {
            parts.push(
              `histórico de mensagens chegando em background (${messageSyncQueued} chats)`,
            );
          }
          toast.success(parts.join(" — "));
        }
        setHasMore(!!more);
        setOffset(nextOffset ?? 0);
        // Atualiza a lista de conversas no sidebar
        qc.invalidateQueries({ queryKey: ["conversations.list"] });
      },
      onError: (err: any) => {
        toast.error(err?.message ?? "Falha ao importar conversas");
      },
    }),
  );

  const handleImport = () => {
    mutation.mutate({
      trackingId,
      type: "both",
      limit: 50,
      offset,
    });
  };

  return (
    <Button
      variant={variant}
      onClick={handleImport}
      disabled={mutation.isPending}
      className="gap-2"
    >
      {mutation.isPending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Importando...
        </>
      ) : (
        <>
          <DownloadIcon className="size-4" />
          {hasMore ? "Importar mais (5★)" : `${label} (5★)`}
        </>
      )}
    </Button>
  );
}
