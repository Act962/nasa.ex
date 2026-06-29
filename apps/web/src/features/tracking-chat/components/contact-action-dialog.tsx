"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { MessageSquareIcon, PlusIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import { withSearchParams } from "../utils/url";

interface ContactActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId: string;
  token: string;
  contactName: string;
  contactPhone: string;
}

export function ContactActionDialog({
  open,
  onOpenChange,
  trackingId,
  token,
  contactName,
  contactPhone,
}: ContactActionDialogProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const buildHref = (conversationId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("trackingId")) params.set("trackingId", trackingId);
    return withSearchParams(`/tracking-chat/${conversationId}`, params);
  };

  const { data, isLoading } = useQuery(
    orpc.conversation.findByPhone.queryOptions({
      input: { trackingId, phone: contactPhone },
      enabled: open,
    }),
  );

  const start = useMutation(
    orpc.conversation.startByPhone.mutationOptions({
      onSuccess: ({ conversationId }) => {
        toast.success("Conversa criada");
        onOpenChange(false);
        router.push(buildHref(conversationId));
      },
      onError: (e: any) => {
        toast.error(e?.message || "Erro ao criar conversa");
      },
    }),
  );

  const existingId = data?.conversationId ?? null;

  const handleGo = () => {
    if (!existingId) return;
    onOpenChange(false);
    router.push(buildHref(existingId));
  };

  const handleCreate = () => {
    start.mutate({
      trackingId,
      phone: contactPhone,
      name: contactName,
      token,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conversar com {contactName}</DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Verificando se já existe uma conversa..."
              : existingId
                ? "Já existe uma conversa com esse contato neste tracking."
                : "Ainda não há uma conversa com esse contato neste tracking."}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 gap-2"
            disabled={isLoading || !existingId || start.isPending}
            onClick={handleGo}
          >
            <MessageSquareIcon className="size-4" />
            Ir para a conversa
          </Button>
          <Button
            type="button"
            className="flex-1 gap-2"
            disabled={isLoading || !!existingId || start.isPending}
            onClick={handleCreate}
          >
            {start.isPending ? (
              <Spinner className="size-4" />
            ) : (
              <PlusIcon className="size-4" />
            )}
            Criar nova conversa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
