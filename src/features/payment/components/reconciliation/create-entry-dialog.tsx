"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { usePaymentCategories, usePaymentContacts } from "../../hooks/use-payment";
import { useCreateEntryFromTransaction } from "../../hooks/use-payment-statements";
import { formatCurrency, formatDate } from "../../lib/format";
import { describePaymentError } from "../../lib/describe-error";
import type { StatementTransactionRow } from "./transactions-list";

const NONE = "__none__";

/** Nome vindo do extrato costuma ser a melhor descrição inicial. */
function suggestDescription(transaction: StatementTransactionRow): string {
  if (transaction.counterpartyName) return transaction.counterpartyName;
  return transaction.memo.split(" - ")[0]?.trim() || transaction.memo.slice(0, 60);
}

export function CreateEntryDialog({
  transaction,
  onClose,
}: {
  transaction: StatementTransactionRow | null;
  onClose: () => void;
}) {
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(NONE);
  const [contactId, setContactId] = useState(NONE);

  const isCredit = transaction?.direction === "CREDIT";
  const { data: categoriesData } = usePaymentCategories(isCredit ? "REVENUE" : "EXPENSE");
  const { data: contactsData } = usePaymentContacts();
  const createEntry = useCreateEntryFromTransaction();

  useEffect(() => {
    if (!transaction) return;
    setDescription(suggestDescription(transaction));
    setCategoryId(NONE);
    setContactId(NONE);
  }, [transaction]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!transaction) return;
    if (!description.trim()) return toast.error("Informe uma descrição");

    try {
      await createEntry.mutateAsync({
        transactionId: transaction.id,
        description: description.trim(),
        categoryId: categoryId === NONE ? null : categoryId,
        contactId: contactId === NONE ? null : contactId,
      });
      toast.success("Lançamento criado e conciliado");
      onClose();
    } catch (error) {
      toast.error(describePaymentError(error, "Não foi possível criar o lançamento"));
    }
  }

  return (
    <Dialog open={Boolean(transaction)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Novo {isCredit ? "recebimento" : "pagamento"} a partir do extrato
          </DialogTitle>
        </DialogHeader>

        {transaction && (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
              <p
                className={`text-lg font-black tabular-nums ${
                  isCredit ? "text-green-400" : "text-red-400"
                }`}
              >
                {formatCurrency(transaction.amountCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(transaction.postedDate)} · já consta como{" "}
                {isCredit ? "recebido" : "pago"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sem categoria</SelectItem>
                    {categoriesData?.categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isCredit ? "Cliente" : "Fornecedor"}</Label>
                <Select value={contactId} onValueChange={setContactId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sem contato</SelectItem>
                    {contactsData?.contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createEntry.isPending}
                className="flex-1 bg-[#1E90FF] text-white hover:bg-[#1E90FF]/90"
              >
                {createEntry.isPending ? "Criando..." : "Criar"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
