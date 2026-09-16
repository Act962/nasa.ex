"use client";

import { useState } from "react";
import { Plus, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePaymentContacts } from "../../hooks/use-payment";
import { REMINDER_MAX_RECIPIENTS, type ReminderRecipient } from "../../schemas/reminders";

const CONTACT_SUGGESTION_LIMIT = 6;

interface ReminderRecipientsFieldProps {
  recipients: ReminderRecipient[];
  onChange: (recipients: ReminderRecipient[]) => void;
}

export function ReminderRecipientsField({ recipients, onChange }: ReminderRecipientsFieldProps) {
  const [contactSearch, setContactSearch] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualEmail, setManualEmail] = useState("");

  const trimmedSearch = contactSearch.trim();
  const { data: contactsData } = usePaymentContacts(trimmedSearch || undefined, undefined, {
    perPage: CONTACT_SUGGESTION_LIMIT,
  });
  const suggestions = trimmedSearch
    ? (contactsData?.contacts ?? []).filter(
        (contact) => !recipients.some((recipient) => recipient.contactId === contact.id),
      )
    : [];
  const isFull = recipients.length >= REMINDER_MAX_RECIPIENTS;

  function addRecipient(recipient: ReminderRecipient) {
    if (isFull) return;
    onChange([...recipients, recipient]);
  }

  function removeRecipient(index: number) {
    onChange(recipients.filter((_, recipientIndex) => recipientIndex !== index));
  }

  function addManualRecipient() {
    const phone = manualPhone.trim();
    const email = manualEmail.trim();
    if (!phone && !email) return;
    addRecipient({
      name: manualName.trim() || phone || email,
      phone: phone || undefined,
      email: email || undefined,
    });
    setManualName("");
    setManualPhone("");
    setManualEmail("");
  }

  return (
    <div className="space-y-2">
      <Label>Destinatários</Label>

      {recipients.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {recipients.map((recipient, index) => (
            <li
              key={`${recipient.contactId ?? recipient.name}-${index}`}
              className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
              title={[recipient.phone, recipient.email].filter(Boolean).join(" · ")}
            >
              <UserRound className="size-3 text-muted-foreground" />
              <span className="max-w-[160px] truncate">{recipient.name}</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => removeRecipient(index)}
                aria-label={`Remover ${recipient.name}`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Input
          placeholder="Buscar contato do financeiro..."
          value={contactSearch}
          disabled={isFull}
          onChange={(event) => setContactSearch(event.target.value)}
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
            {suggestions.map((contact) => (
              <li key={contact.id}>
                <button
                  type="button"
                  className="flex w-full flex-col items-start px-3 py-1.5 text-left text-xs hover:bg-muted"
                  onClick={() => {
                    addRecipient({
                      contactId: contact.id,
                      name: contact.name,
                      phone: contact.phone ?? undefined,
                      email: contact.email ?? undefined,
                    });
                    setContactSearch("");
                  }}
                >
                  <span className="font-medium">{contact.name}</span>
                  <span className="text-muted-foreground">
                    {[contact.phone, contact.email].filter(Boolean).join(" · ") || "sem telefone e e-mail"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <Input placeholder="Nome" value={manualName} disabled={isFull} onChange={(event) => setManualName(event.target.value)} />
        <Input placeholder="Telefone com DDD" value={manualPhone} disabled={isFull} onChange={(event) => setManualPhone(event.target.value)} />
        <Input type="email" placeholder="E-mail" value={manualEmail} disabled={isFull} onChange={(event) => setManualEmail(event.target.value)} />
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Adicionar destinatário avulso"
          disabled={isFull || (!manualPhone.trim() && !manualEmail.trim())}
          onClick={addManualRecipient}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
