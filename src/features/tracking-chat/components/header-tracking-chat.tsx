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
import { MessageChannel, StatusFlow } from "@/generated/prisma/enums";
import { useMutationRodizio } from "../hooks/use-rodizio";
import { SyncMessagesButton } from "./sync-messages-button";
import type { SVGProps } from "react";

interface HeaderProps {
  name: string;
  profile?: string;
  phone?: string;
  leadId: string;
  conversationId: string;
  active: boolean;
  trackingId: string;
  statusFlow: StatusFlow;
  channel?: MessageChannel;
}

function ChannelBadge({ channel }: { channel: MessageChannel }) {
  if (channel === MessageChannel.INSTAGRAM) {
    return (
      <span title="Instagram DM" className="flex items-center justify-center size-6 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white shrink-0">
        <InstagramIcon className="size-3.5" />
      </span>
    )
  }
  if (channel === MessageChannel.FACEBOOK) {
    return (
      <span title="Facebook Messenger" className="flex items-center justify-center size-6 rounded-full bg-[#0082FB] text-white shrink-0">
        <FacebookIcon className="size-3.5" />
      </span>
    )
  }
  return null
}

function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2m0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95zm8.95 1.35a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2M12 6.85A5.15 5.15 0 1 1 6.85 12 5.16 5.16 0 0 1 12 6.85m0 1.8A3.35 3.35 0 1 0 15.35 12 3.35 3.35 0 0 0 12 8.65" />
    </svg>
  )
}

function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M13.5 22v-8.2h2.77l.42-3.2H13.5V8.56c0-.93.26-1.56 1.6-1.56h1.7V4.13c-.3-.04-1.32-.13-2.51-.13-2.48 0-4.19 1.52-4.19 4.3v2.3H7.3v3.2h2.8V22z" />
    </svg>
  )
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
  channel,
}: HeaderProps) {
  const router = useRouter();
  const profileUrl = useConstructUrl(profile || "");
  const mutation = useMutationRodizio(conversationId);

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
        <div className="relative">
          <Avatar>
            <AvatarImage src={profileUrl} />
            <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          {channel && channel !== MessageChannel.WHATSAPP && (
            <span className="absolute -bottom-1 -right-1">
              <ChannelBadge channel={channel} />
            </span>
          )}
        </div>
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
        <SyncMessagesButton conversationId={conversationId} />
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
