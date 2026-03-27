import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { WhatsappIcon } from "@/components/whatsapp";
import { useCreateConversation } from "@/features/tracking-chat/hooks/use-conversation";
import { UserIcon } from "lucide-react";

interface EmptyConversationProps {
  lead: {
    id: string;
    phone: string;
  };
  trackingId: string;
  apikey: string;
}

export function EmptyConversation({
  lead,
  trackingId,
  apikey,
}: EmptyConversationProps) {
  const mutation = useCreateConversation({ trackingId });

  function onSubmit() {
    mutation.mutate({
      phone: [lead.phone],
      trackingId: trackingId,
      token: apikey,
    });
  }
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UserIcon />
        </EmptyMedia>
        <EmptyTitle>Lead não possui conversa</EmptyTitle>
        <EmptyDescription>
          Clique no botão abaixo para criar uma conversa neste lead
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        <Button onClick={onSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner /> : <WhatsappIcon />}
          Criar conversa
        </Button>
      </EmptyContent>
    </Empty>
  );
}
