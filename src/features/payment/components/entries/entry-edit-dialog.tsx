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
import { Textarea } from "@/components/ui/textarea";
import {
  useUpdatePaymentEntry,
  usePaymentCategories,
  usePaymentContacts,
} from "../../hooks/use-payment";
import { formatCurrency, parseCurrencyToCents } from "../../lib/format";
import { toDateInputValue } from "../../lib/dates";
import { describePaymentError } from "../../lib/describe-error";
import {
  entryEditSchema,
  toFieldErrors,
  type EntryFieldErrors,
} from "../../schemas/entry-form-schema";
import { EntryAttachmentsSection } from "../attachments/entry-attachments-section";
import { FieldError, fieldErrorClass } from "../shared/field-error";
import { toast } from "sonner";

interface EditableEntry {
  id: string;
  type: "RECEIVABLE" | "PAYABLE";
  description: string;
  amount: number;
  dueDate: string | Date;
  categoryId: string | null;
  contactId: string | null;
  notes: string | null;
}

interface EntryEditDialogProps {
  entry: EditableEntry | null;
  onClose: () => void;
}

const NONE = "__none__";

export function EntryEditDialog({ entry, onClose }: EntryEditDialogProps) {
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [categoryId, setCategoryId] = useState<string>(NONE);
  const [contactId, setContactId] = useState<string>(NONE);
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<EntryFieldErrors>({});
  const updateEntry = useUpdatePaymentEntry();

  function clearFieldError(field: keyof EntryFieldErrors) {
    setFieldErrors((current) =>
      current[field] ? { ...current, [field]: undefined } : current,
    );
  }

  const { data: categoriesData } = usePaymentCategories(
    entry?.type === "PAYABLE" ? "EXPENSE" : "REVENUE",
  );
  const { data: contactsData } = usePaymentContacts();

  // Sincroniza os campos sempre que abre com uma entry diferente.
  useEffect(() => {
    if (!entry) return;
    setDescription(entry.description);
    setAmountStr(formatCurrency(entry.amount));
    setDueDate(toDateInputValue(entry.dueDate));
    setCategoryId(entry.categoryId ?? NONE);
    setContactId(entry.contactId ?? NONE);
    setNotes(entry.notes ?? "");
    setFieldErrors({});
  }, [entry]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!entry) return;

    const parsed = entryEditSchema.safeParse({
      description,
      amount: parseCurrencyToCents(amountStr),
      dueDate,
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    setFieldErrors({});
    try {
      await updateEntry.mutateAsync({
        id: entry.id,
        description: parsed.data.description,
        amount: parsed.data.amount,
        dueDate: parsed.data.dueDate,
        categoryId: categoryId === NONE ? null : categoryId,
        contactId: contactId === NONE ? null : contactId,
        notes: notes.trim() ? notes : null,
      });
      toast.success("Lançamento atualizado");
      onClose();
    } catch (error) {
      toast.error(describePaymentError(error, "Não foi possível atualizar o lançamento"));
    }
  }

  const contactLabel = entry?.type === "PAYABLE" ? "Fornecedor" : "Cliente";

  return (
    <Dialog open={!!entry} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto scroll-cols-tracking">
        <DialogHeader>
          <DialogTitle>Editar Lançamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input
              value={description}
              aria-invalid={!!fieldErrors.description}
              className={fieldErrors.description ? fieldErrorClass : undefined}
              onChange={(event) => {
                setDescription(event.target.value);
                clearFieldError("description");
              }}
              autoFocus
            />
            <FieldError message={fieldErrors.description} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input
                placeholder="R$ 0,00"
                value={amountStr}
                aria-invalid={!!fieldErrors.amount}
                className={fieldErrors.amount ? fieldErrorClass : undefined}
                onChange={(event) => {
                  setAmountStr(event.target.value);
                  clearFieldError("amount");
                }}
              />
              <FieldError message={fieldErrors.amount} />
            </div>
            <div className="space-y-2">
              <Label>Vencimento *</Label>
              <Input
                type="date"
                value={dueDate}
                aria-invalid={!!fieldErrors.dueDate}
                className={fieldErrors.dueDate ? fieldErrorClass : undefined}
                onChange={(event) => {
                  setDueDate(event.target.value);
                  clearFieldError("dueDate");
                }}
              />
              <FieldError message={fieldErrors.dueDate} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem categoria</SelectItem>
                  {categoriesData?.categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{contactLabel}</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem contato</SelectItem>
                  {contactsData?.contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>{contact.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {entry && <EntryAttachmentsSection entryId={entry.id} />}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updateEntry.isPending}
              className="flex-1 bg-[#1E90FF] hover:bg-[#1E90FF]/90 text-white"
            >
              {updateEntry.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
