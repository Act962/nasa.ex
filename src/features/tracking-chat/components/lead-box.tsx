"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Lead } from "@/generated/prisma/client";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { AvatarLead } from "./avatar-lead";

interface UserBloxProps {
  item: Lead;
  lastMessageText?: string;
}

export function LeadBox({ item, lastMessageText }: UserBloxProps) {
  const router = useRouter();
  const query = useSearchParams();

  const handleClick = useCallback(() => {
    router.push(`/lead/${item.id}`);
  }, [router, item]);

  const selected = item.id === query.get("id");
  const hasSeen = false;

  return (
    <div
      onClick={handleClick}
      className={`w-full relative flex items-center space-x-3 p-3 hover:bg-accent-foreground/5 cursor-pointer rounded-lg transition  ${selected ? "bg-accent-foreground/5" : ""}`}
    >
      <AvatarLead Lead={item} />
      <div className="min-w-0 flex-1">
        <div className="focus:outline-none">
          <div className="flex justify-between items-center mb-1">
            <p className="text-sm font-medium">{item.name}</p>
            <p className="text-xs font-light">
              {format(new Date(item.createdAt), "dd/MM/yyyy")}
            </p>
          </div>
          {lastMessageText && (
            <p
              className={`text-xs font-light ${hasSeen ? "text-muted-foreground" : ""}`}
            >
              {lastMessageText}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
