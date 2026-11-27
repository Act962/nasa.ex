"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { phoneMaskFull } from "@/utils/format-phone";
import type { ReceiptClientDraft } from "./receipt-draft";

/** Dados do cliente no recibo. `fixedPhone` = telefone do cadastro do lead, só leitura; sem ele, o campo é digitável. */
export function ReceiptClientFields({
  client,
  fixedPhone,
  isRequired,
  onChange,
}: {
  client: ReceiptClientDraft;
  fixedPhone: string | null;
  isRequired: boolean;
  onChange: (client: ReceiptClientDraft) => void;
}) {
  const set = (key: keyof ReceiptClientDraft) => (event: React.ChangeEvent<HTMLInputElement>) => onChange({ ...client, [key]: event.target.value });
  const requiredMark = isRequired ? " *" : "";
  return (
    <div className="grid gap-2">
      <div>
        <Label className="text-xs text-muted-foreground">Nome{requiredMark}</Label>
        <Input value={client.name} onChange={set("name")} maxLength={120} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs text-muted-foreground">WhatsApp{requiredMark}</Label>
          {fixedPhone ? (
            <Input value={phoneMaskFull(fixedPhone)} disabled />
          ) : (
            <Input
              inputMode="tel"
              placeholder="(86) 99999-9999"
              value={phoneMaskFull(client.phone)}
              onChange={(event) => onChange({ ...client, phone: event.target.value.replace(/\D/g, "") })}
            />
          )}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">CPF ou CNPJ</Label>
          <Input value={client.document} onChange={set("document")} inputMode="numeric" maxLength={20} />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_5.5rem] gap-2">
        <div className="min-w-0">
          <Label className="text-xs text-muted-foreground">Rua</Label>
          <Input value={client.street} onChange={set("street")} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Número</Label>
          <Input value={client.number} onChange={set("number")} />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_1fr_4rem] gap-2">
        <div className="min-w-0">
          <Label className="text-xs text-muted-foreground">Bairro</Label>
          <Input value={client.neighborhood} onChange={set("neighborhood")} />
        </div>
        <div className="min-w-0">
          <Label className="text-xs text-muted-foreground">Cidade</Label>
          <Input value={client.city} onChange={set("city")} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">UF</Label>
          <Input value={client.state} onChange={set("state")} maxLength={2} />
        </div>
      </div>
    </div>
  );
}
