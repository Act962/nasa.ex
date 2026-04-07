"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePaymentCategories, usePaymentContacts, usePaymentAccounts } from "../../hooks/use-payment";
import { parseCurrencyToCents } from "../../lib/format";
import { toast } from "sonner";

interface EntryFormProps {
  type: "RECEIVABLE" | "PAYABLE";
  onSubmit: (data: {
    type: "RECEIVABLE" | "PAYABLE";
    description: string;
    amount: number;
    dueDate: string;
    categoryId?: string;
    contactId?: string;
    accountId?: string;
    notes?: string;
    documentNumber?: string;
    installments: number;
  }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function EntryForm({ type, onSubmit, onCancel, isLoading }: EntryFormProps) {
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState<string>("__none__");
  const [contactId, setContactId] = useState<string>("__none__");
  const [accountId, setAccountId] = useState<string>("__none__");
  const [notes, setNotes] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [installments, setInstallments] = useState(1);

  const { data: categoriesData } = usePaymentCategories(
    type === "RECEIVABLE" ? "REVENUE" : "EXPENSE"
  );
  const { data: contactsData } = usePaymentContacts();
  const { data: accountsData } = usePaymentAccounts();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return toast.error("Descrição obrigatória");
    const amount = parseCurrencyToCents(amountStr);
    if (!amount) return toast.error("Valor inválido");
    await onSubmit({
      type,
      description,
      amount,
      dueDate,
      categoryId: categoryId === "__none__" ? undefined : categoryId,
      contactId: contactId === "__none__" ? undefined : contactId,
      accountId: accountId === "__none__" ? undefined : accountId,
      notes: notes || undefined,
      documentNumber: documentNumber || undefined,
      installments,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Descrição *</Label>
        <Input
          placeholder="Ex: Mensalidade cliente..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Valor *</Label>
          <Input
            placeholder="R$ 0,00"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Vencimento *</Label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem categoria</SelectItem>
              {categoriesData?.categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{type === "RECEIVABLE" ? "Cliente" : "Fornecedor"}</Label>
          <Select value={contactId} onValueChange={setContactId}>
            <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem contato</SelectItem>
              {contactsData?.contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Conta Bancária</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem conta</SelectItem>
              {accountsData?.accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Parcelas</Label>
          <Select value={String(installments)} onValueChange={(v) => setInstallments(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Nº do Documento</Label>
        <Input placeholder="Ex: NF-0001" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" disabled={isLoading} className="flex-1 bg-[#1E90FF] hover:bg-[#1E90FF]/90 text-white">
          {isLoading ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
