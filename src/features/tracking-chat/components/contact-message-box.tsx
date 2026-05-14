"use client";

import { MessageCircleIcon, UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ContactActionDialog } from "./contact-action-dialog";

interface ContactMessageBoxProps {
  name: string | null | undefined;
  phone: string | null | undefined;
  trackingId?: string;
  token?: string;
}

export function ContactMessageBox({
  name,
  phone,
  trackingId,
  token,
}: ContactMessageBoxProps) {
  const [open, setOpen] = useState(false);
  const canChat = !!phone && !!trackingId && !!token;

  return (
    <>
      <div className="block w-64 overflow-hidden rounded-md border bg-background">
        <div className="flex items-center gap-3 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
            <UserIcon className="size-5 text-muted-foreground" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium truncate">
              {name || "Contato"}
            </span>
            {phone && (
              <span className="text-xs text-muted-foreground truncate">
                {phone}
              </span>
            )}
          </div>
        </div>
        {canChat && (
          <div className="border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full rounded-none h-9 gap-2 text-xs"
              onClick={() => setOpen(true)}
            >
              <MessageCircleIcon className="size-3.5" />
              Conversar
            </Button>
          </div>
        )}
      </div>

      {canChat && (
        <ContactActionDialog
          open={open}
          onOpenChange={setOpen}
          trackingId={trackingId!}
          token={token!}
          contactName={name || "Contato"}
          contactPhone={phone!}
        />
      )}
    </>
  );
}
