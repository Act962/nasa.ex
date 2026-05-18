"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogDescription,
  DialogContent,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { useFindChat } from "@/features/tracking-chat/hooks/use-conversation";

type SendMessageDialogProps = {
  trackingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (chatId: string, chatName: string) => void;
  selectedChatIds?: string[];
};

export function SendMessageDialog({
  trackingId,
  open,
  onOpenChange,
  onSelect,
  selectedChatIds = [],
}: SendMessageDialogProps) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [isGroup, setIsGroup] = useState(false);

  const debouncedPhone = useDebouncedValue(phone, 400);
  const debouncedName = useDebouncedValue(name, 400);

  const { data, isLoading } = useFindChat({
    trackingId,
    phone: debouncedPhone,
    name: debouncedName,
    isGroup,
    limit: 20,
    offset: 0,
    enabled: open,
  });

  const chats = (data?.response?.chats ?? []).filter(
    (chat: any) => !selectedChatIds.includes(chat.wa_chatid),
  );
  const hasSearch =
    debouncedPhone.trim().length > 0 || debouncedName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buscar chat</DialogTitle>
          <DialogDescription>
            Pesquise por telefone ou nome no WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field>
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field orientation="horizontal">
            <Checkbox
              id="isGroup"
              checked={isGroup}
              onCheckedChange={(v) => setIsGroup(v === true)}
            />
            <Label htmlFor="isGroup">Grupo</Label>
          </Field>
        </FieldGroup>

        <div className="max-h-72 overflow-y-auto">
          {isLoading && hasSearch && (
            <p className="text-sm text-muted-foreground px-2">Buscando...</p>
          )}
          {!isLoading && hasSearch && chats.length === 0 && (
            <p className="text-sm text-muted-foreground px-2">
              Nenhum chat encontrado.
            </p>
          )}
          {chats.map((chat: any) => (
            <button
              key={chat.id}
              type="button"
              className="w-full text-left py-2 px-2 rounded hover:bg-accent border-b last:border-b-0 transition-colors"
              onClick={() => {
                const displayName =
                  chat.wa_name ||
                  chat.wa_contactName ||
                  chat.name ||
                  chat.phone;
                onSelect(chat.wa_chatid, displayName);
                onOpenChange(false);
              }}
            >
              <p className="text-sm font-medium">
                {chat.wa_name || chat.wa_contactName || chat.name || chat.phone}
              </p>
              <p className="text-xs text-muted-foreground">{chat.phone}</p>
            </button>
          ))}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
