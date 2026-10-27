"use client";

// Campo "Cliente" da cobrança: busca contatos do financeiro e leads do funil, e cria um
// contato novo sem sair do formulário. O número só tem o formato conferido (aviso, não
// bloqueio): se ele recebe a mensagem, quem diz é o histórico de avisos.

import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, Plus, Search, TriangleAlert, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { cn } from "@/lib/utils";
import { describeWhatsappPhoneProblem, normalizeWhatsappPhoneBr, phoneMaskFull } from "@/utils/format-phone";
import { useCreatePaymentContact } from "../../hooks/use-payment";
import { usePaymentCustomerSearch } from "../../hooks/use-payment-customers";
import { describePaymentError } from "../../lib/describe-error";

const SEARCH_DEBOUNCE_MS = 300;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type PaymentCustomer = {
  kind: "contact" | "lead";
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  origin: string | null;
};

interface CustomerPickerProps {
  value: PaymentCustomer | null;
  onChange: (customer: PaymentCustomer | null) => void;
}

export function CustomerPicker({ value, onChange }: CustomerPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const { data, isFetching } = usePaymentCustomerSearch(debouncedSearch, { enabled: isOpen });
  const customers = data?.customers ?? [];

  function handleSelect(customer: PaymentCustomer) {
    onChange(customer);
    setIsOpen(false);
    setSearch("");
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) setIsCreating(false);
  }

  return (
    // `modal`: o Dialog da Nova Receita trava a rolagem fora dele, e a lista é renderizada
    // num portal fora do Dialog; como modal, o Popover libera a rolagem do próprio conteúdo.
    <Popover open={isOpen} onOpenChange={handleOpenChange} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-full border border-input bg-card px-4 text-left text-sm shadow-xs"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? value.name : "Buscar cliente ou lead..."}
          </span>
          {value ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Tirar cliente"
              onClick={(event) => {
                event.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.stopPropagation();
                  onChange(null);
                }
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </span>
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-72 p-2">
        {isCreating ? (
          <NewCustomerForm
            initialName={search}
            onCancel={() => setIsCreating(false)}
            onCreated={handleSelect}
          />
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome, telefone ou e-mail"
                className="h-9 pl-9 text-sm"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {customers.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                  {isFetching ? "Buscando..." : "Nenhum cliente encontrado."}
                </p>
              ) : (
                customers.map((customer) => (
                  <button
                    key={`${customer.kind}-${customer.id}`}
                    type="button"
                    onClick={() => handleSelect(customer)}
                    className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted"
                  >
                    <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{customer.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {customer.kind === "lead" ? `Lead · ${customer.origin ?? "Funil"}` : "Contato do financeiro"}
                        {" · "}
                        {customer.phone ? phoneMaskFull(customer.phone) : customer.email ?? "sem contato"}
                      </span>
                    </span>
                    {value?.kind === customer.kind && value.id === customer.id && (
                      <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    )}
                  </button>
                ))
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="size-3.5" />
              Novo cliente
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NewCustomerForm({
  initialName,
  onCancel,
  onCreated,
}: {
  initialName: string;
  onCancel: () => void;
  onCreated: (customer: PaymentCustomer) => void;
}) {
  const createContact = useCreatePaymentContact();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const phoneProblem = describeWhatsappPhoneProblem(phone);
  const emailProblem = email.trim() && !EMAIL_PATTERN.test(email.trim()) ? "E-mail com formato inválido." : null;

  function handleCreate() {
    if (!name.trim()) return toast.error("Informe o nome do cliente");
    if (emailProblem) return toast.error(emailProblem);
    const normalizedPhone = phone.trim() ? normalizeWhatsappPhoneBr(phone) ?? phone.replace(/\D/g, "") : undefined;
    createContact.mutate(
      {
        name: name.trim(),
        phone: normalizedPhone,
        email: email.trim() || undefined,
        contactType: "CUSTOMER",
      },
      {
        onSuccess: ({ contact }) => {
          toast.success("Cliente cadastrado");
          onCreated({
            kind: "contact",
            id: contact.id,
            name: contact.name,
            phone: contact.phone ?? null,
            email: contact.email ?? null,
            origin: null,
          });
        },
        onError: (error) => toast.error(describePaymentError(error, "Não foi possível cadastrar o cliente")),
      },
    );
  }

  return (
    <div className="space-y-2.5 p-1">
      <p className="text-sm font-medium">Novo cliente</p>
      <div className="space-y-1">
        <Label className="text-xs">Nome *</Label>
        <Input value={name} onChange={(event) => setName(event.target.value)} className="h-9 text-sm" autoFocus />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">WhatsApp</Label>
        <Input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="(86) 99999-0000"
          inputMode="tel"
          className="h-9 text-sm"
        />
        {phoneProblem && (
          <p className="flex items-start gap-1 text-[11px] text-warning">
            <TriangleAlert className="mt-px size-3 shrink-0" />
            {phoneProblem} Dá para salvar assim mesmo.
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">E-mail</Label>
        <Input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="cliente@email.com"
          inputMode="email"
          className="h-9 text-sm"
        />
        {emailProblem && <p className="text-[11px] text-destructive">{emailProblem}</p>}
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={onCancel}>
          Voltar
        </Button>
        <Button type="button" size="sm" className="flex-1" onClick={handleCreate} disabled={createContact.isPending}>
          {createContact.isPending ? "Salvando..." : "Cadastrar"}
        </Button>
      </div>
    </div>
  );
}
