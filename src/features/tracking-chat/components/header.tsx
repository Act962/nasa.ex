"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { phoneMaskFull } from "@/utils/format-phone";
import { ArrowLeftIcon, MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";

interface HeaderProps {
  name: string;
  profile?: string;
  phone?: string;
}
export function Header({ name, profile, phone }: HeaderProps) {
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
          <AvatarImage src={profile} />
          <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <div>{name}</div>
          {phone && (
            <div className="text-xs font-light text-foreground/40">
              {phoneMaskFull(phone)}
            </div>
          )}
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
