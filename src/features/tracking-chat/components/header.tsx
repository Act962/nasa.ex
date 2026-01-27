"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";

interface HeaderProps {
  conversation: any;
}
export function Header({ conversation }: HeaderProps) {
  return (
    <div className="bg-accent-foreground/10 w-full flex border-b sm:px-4 py-3 px-4 lg:px-6 justify-between items-center shadow-sm">
      <div className="flex gap-3 items-center">
        <Link
          className="lg:hidden block transition cursor-pointer"
          href={`tracking-chat`}
        >
          <ArrowLeftIcon className="size-4" />
        </Link>
        <Avatar>
          <AvatarImage src={conversation.avatar} />
          <AvatarFallback>CF</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <div>{conversation.name}</div>
          <div className="text-xs font-light text-foreground/40">
            {conversation.name}
          </div>
        </div>
      </div>
      <Button variant="ghost">
        <MoreHorizontalIcon
          onClick={() => {}}
          className="transition cursor-pointer size-4"
        />
      </Button>
    </div>
  );
}
