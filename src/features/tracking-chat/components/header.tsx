"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { phoneMaskFull } from "@/utils/format-phone";
import { ArrowLeftIcon, MoreHorizontalIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { SummerizeConversation } from "./summerize-conversation";
import { OptionsHeader } from "./options-header";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutationLeadUpdate } from "@/features/leads/hooks/use-lead-update";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";

interface HeaderProps {
  name: string;
  profile?: string;
  phone?: string;
  leadId: string;
  conversationId: string;
  active: boolean;
}
export function Header({
  name,
  profile,
  phone,
  leadId,
  conversationId,
  active: initialActive,
}: HeaderProps) {
  const router = useRouter();
  const profileUrl = useConstructUrl(profile || "");
  const [active, setActive] = useState(initialActive);
  const mutationLeadUpdate = useMutationLeadUpdate(leadId);

  const onActiveChange = (checked: boolean) => {
    setActive(checked);
    mutationLeadUpdate.mutate({
      id: leadId,
      active: checked,
    });
  };

  const onCloseChat = () => {
    router.push(`/tracking-chat`);
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
      <div className="flex items-center gap-2">
        <Switch
          name="active"
          checked={active}
          onCheckedChange={onActiveChange}
        />
        <SummerizeConversation conversationId={conversationId} />
        <Button variant="ghost" size="icon-sm" onClick={onCloseChat}>
          <XIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
