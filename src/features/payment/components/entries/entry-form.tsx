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
import { ChevronDown } from "lucide-react";
import {
  usePaymentCategories,
  usePaymentContacts,
  usePaymentAccounts,
  useRecentEntryDescriptions,
} from "../../hooks/use-payment";
import { useDunningRules } from "../../hooks/use-payment-dunning";
import { parseCurrencyToCents, maskCurrency } from "../../lib/format";
import { todayAsDateInput } from "../../lib/dates";
import {
  entryFormSchema,
  toFieldErrors,
  MAX_INSTALLMENTS,
  type EntryFieldErrors,
} from "../../schemas/entry-form-schema";
import { AttachmentUploader } from "../attachments/attachment-uploader";
import { FieldError, fieldErrorClass } from "../shared/field-error";

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
    requiresApproval?: boolean;
    dunningRuleId?: string;
    attachmentIds?: string[];
  }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

// Dropdown travado na largura do campo; texto longo trunca com reticências em
// vez de quebrar linha (o span do label é forçado a block + min-w-0 + truncate).
const dropdownContentClass =
  "max-h-60 w-[var(--radix-select-trigger-width)] scroll-cols-tracking " +
  "[&_[data-slot=select-item]>span:last-child]:block " +
  "[&_[data-slot=select-item]>span:last-child]:min-w-0 " +
  "[&_[data-slot=select-item]>span:last-child]:truncate";

// Trigger ocupa toda a coluna (shadcn usa w-fit por padrão) e encolhe (min-w-0)
// pra que o valor selecionado longo trunque com line-clamp-1 em vez de vazar.
const selectTriggerClass = "w-full min-w-0";

export function EntryForm({ type, onSubmit, onCancel, isLoading }: EntryFormProps) {
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  // `todayAsDateInput` usa o calendário local: `toISOString()` devolvia o dia
  // seguinte pra quem preenchia depois das 21h no horário de Brasília.
  const [dueDate, setDueDate] = useState(todayAsDateInput());
  const [categoryId, setCategoryId] = useState<string>("__none__");
  const [contactId, setContactId] = useState<string>("__none__");
  const [accountId, setAccountId] = useState<string>("__none__");
  const [notes, setNotes] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [installments, setInstallments] = useState(1);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [dunningRuleId, setDunningRuleId] = useState<string>("__none__");
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<EntryFieldErrors>({});

  // Some com o erro assim que o campo é corrigido — manter a mensagem até o
  // próximo submit faz o formulário parecer quebrado enquanto se digita.
  function clearFieldError(field: keyof EntryFieldErrors) {
    setFieldErrors((current) =>
      current[field] ? { ...current, [field]: undefined } : current,
    );
  }

  const { data: categoriesData } = usePaymentCategories(
    type === "RECEIVABLE" ? "REVENUE" : "EXPENSE"
  );
  const { data: contactsData } = usePaymentContacts();
  const { data: accountsData } = usePaymentAccounts();
  // Régua só faz sentido em RECEIVABLE — pedimos só nesse caso pra economizar
  // 1 request/render quando o user tá cadastrando A pagar.
  const { data: dunningData } = useDunningRules();
  const { data: recentData } = useRecentEntryDescriptions(type);
  const recentDescriptions = recentData?.descriptions ?? [];
  const availableRules = type === "RECEIVABLE"
    ? (dunningData?.rules ?? []).filter((r) => r.isActive)
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validação por campo em vez de um toast genérico: a mensagem aparece
    // embaixo do input que está errado, e todos os problemas de uma vez.
    const parsed = entryFormSchema.safeParse({
      description,
      amount: parseCurrencyToCents(amountStr),
      dueDate,
      installments,
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    setFieldErrors({});
    await onSubmit({
      type,
      description: parsed.data.description,
      amount: parsed.data.amount,
      dueDate,
      categoryId: categoryId === "__none__" ? undefined : categoryId,
      contactId: contactId === "__none__" ? undefined : contactId,
      accountId: accountId === "__none__" ? undefined : accountId,
      notes: notes || undefined,
      documentNumber: documentNumber || undefined,
      installments,
      requiresApproval,
      dunningRuleId: dunningRuleId === "__none__" ? undefined : dunningRuleId,
      attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Descrição *</Label>
        <Input
          placeholder="Ex: Mensalidade cliente..."
          value={description}
          aria-invalid={!!fieldErrors.description}
          className={fieldErrors.description ? fieldErrorClass : undefined}
          onChange={(e) => {
            setDescription(e.target.value);
            clearFieldError("description");
          }}
        />
        <FieldError message={fieldErrors.description} />
        {recentDescriptions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recentDescriptions.map((recent) => (
              <button
                key={recent}
                type="button"
                onClick={() => {
                  setDescription(recent);
                  clearFieldError("description");
                }}
                className="max-w-full truncate rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={recent}
              >
                {recent}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Valor *</Label>
          <Input
            placeholder="R$ 0,00"
            inputMode="numeric"
            value={amountStr}
            aria-invalid={!!fieldErrors.amount}
            className={fieldErrors.amount ? fieldErrorClass : undefined}
            onChange={(e) => {
              setAmountStr(maskCurrency(e.target.value));
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
            onChange={(e) => {
              setDueDate(e.target.value);
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
            <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent position="popper" className={dropdownContentClass}>
              <SelectItem value="__none__">Sem categoria</SelectItem>
              {categoriesData?.categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Conta Bancária</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent position="popper" className={dropdownContentClass}>
              <SelectItem value="__none__">Sem conta</SelectItem>
              {accountsData?.accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border/60">
        <button
          type="button"
          onClick={() => setShowMoreOptions((open) => !open)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/60"
          aria-expanded={showMoreOptions}
        >
          Mais opções
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${
              showMoreOptions ? "rotate-180" : ""
            }`}
          />
        </button>

        {showMoreOptions && (
          <div className="space-y-3 border-t p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{type === "RECEIVABLE" ? "Cliente" : "Fornecedor"}</Label>
                <Select value={contactId} onValueChange={setContactId}>
                  <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent position="popper" className={dropdownContentClass}>
                    <SelectItem value="__none__">Sem contato</SelectItem>
                    {contactsData?.contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Parcelas</Label>
                <Select value={String(installments)} onValueChange={(v) => setInstallments(Number(v))}>
                  <SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger>
                  <SelectContent position="popper" className={dropdownContentClass}>
                    {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1).map((n) => (
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
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Anexos</Label>
        <AttachmentUploader onChange={setAttachmentIds} disabled={isLoading} />
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="max-h-32 overflow-y-auto scroll-cols-tracking resize-none"
        />
      </div>

      {type === "RECEIVABLE" && availableRules.length > 0 && (
        <div className="space-y-2">
          <Label>Régua de cobrança</Label>
          <Select value={dunningRuleId} onValueChange={setDunningRuleId}>
            <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent position="popper" className={dropdownContentClass}>
              <SelectItem value="__none__">Sem régua</SelectItem>
              {availableRules.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}{r.isDefault ? " (padrão)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Steps disparam via Inngest event-driven nos dias configurados em Settings → Régua de Cobrança.
          </p>
        </div>
      )}

      <label
        className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 cursor-pointer hover:bg-amber-500/10 transition-colors"
        title="Marca esse lançamento como exigindo aprovação manual antes de virar PENDENTE no fluxo de pagamento"
      >
        <input
          type="checkbox"
          checked={requiresApproval}
          onChange={(e) => setRequiresApproval(e.target.checked)}
          className="mt-0.5 size-4 accent-amber-500"
        />
        <div className="space-y-0.5">
          <p className="text-xs font-medium">Exigir aprovação manual</p>
          <p className="text-[11px] text-muted-foreground">
            Vai pra aba "Aprovações" e só entra em PENDENTE depois que um aprovador
            (Master, Adm ou usuário permissionado) liberar. Configuração de threshold
            automático fica em Settings → Governança.
          </p>
        </div>
      </label>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" disabled={isLoading} className="flex-1 bg-[#1E90FF] hover:bg-[#1E90FF]/90 text-white">
          {isLoading ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
