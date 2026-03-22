"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { phoneMaskFull } from "@/utils/format-phone";
import { ArrowLeftIcon, CheckIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { SummerizeConversation } from "./summerize-conversation";
import { useRouter } from "next/navigation";
import { CheckIaLead } from "./check-ia-lead";
import { StatusFlow } from "@/generated/prisma/enums";
import { useMutationRodizio } from "../hooks/use-rodizio";

interface HeaderProps {
  name: string;
  profile?: string;
  phone?: string;
  leadId: string;
  conversationId: string;
  active: boolean;
  trackingId: string;
  statusFlow: StatusFlow;
}
export function Header({
  name,
  profile,
  phone,
  leadId,
  conversationId,
  active: initialActive,
  trackingId,
  statusFlow,
}: HeaderProps) {
  const router = useRouter();
  const profileUrl = useConstructUrl(profile || "");
  const mutation = useMutationRodizio();

  const onCloseChat = () => {
    router.push(`/tracking-chat`);
  };

  const handleFinishLead = () => {
    mutation.mutate({
      leadId,
      trackingId,
    });
  };

  return (
    <div className="bg-accent-foreground/10 w-full flex border-b sm:px-4 py-3 px-4 lg:px-6 justify-between items-center shadow-sm">
      <div className="flex gap-3 items-center">
        <Button variant="ghost" size="sm" className="lg:hidden block">
          <Link href={`/tracking-chat`}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <Avatar>
          <AvatarImage src={profileUrl} />
          <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <Link
            href={`/contatos/${leadId}`}
            className="hover:underline underline-offset-3"
          >
            {name || "Sem nome"}
          </Link>
          {phone && (
            <div className="text-xs font-light text-foreground/40">
              {phoneMaskFull(phone)}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <SummerizeConversation conversationId={conversationId} />
        <CheckIaLead
          size={"default"}
          active={initialActive}
          leadId={leadId}
          trackingId={trackingId}
        />
        <Button
          onClick={handleFinishLead}
          variant={statusFlow === "FINISHED" ? "default" : "outline"}
          disabled={statusFlow === "FINISHED" || mutation.isPending}
        >
          Finalizar <CheckIcon className="size" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onCloseChat}>
          <XIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
