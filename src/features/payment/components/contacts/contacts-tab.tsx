"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  Zap,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  usePaymentContacts,
  useCreatePaymentContact,
  useUpdatePaymentContact,
  useDeletePaymentContact,
  useExternalContacts,
} from "../../hooks/use-payment";
import {
  ContactAddressFields,
  EMPTY_CONTACT_ADDRESS,
  toContactAddress,
  toContactAddressInput,
  type ContactAddress,
} from "./contact-address-fields";
import { CONTACT_TYPE_LABELS } from "../../lib/format";
import { toast } from "sonner";
import { describePaymentError } from "../../lib/describe-error";
import { cn } from "@/lib/utils";
import { PhoneCountryInput } from "@/components/phone-country-input";
import { formatPhoneWithCountry, toInternationalPhoneDigits } from "@/utils/format-phone";
import { validateCNPJ, validateCPF } from "@/utils/validate-data";
import { useDebouncedValue } from "@/hooks/use-debounced";
import {
  PaymentPagination,
  PaymentPaginationNav,
  PAYMENT_PAGE_SIZE,
  PAYMENT_SEARCH_DEBOUNCE_MS,
} from "../shared/payment-pagination";

// ── CPF/CNPJ validation ───────────────────────────────────────────────────────

type DocType = "CPF" | "CNPJ";

const DOC_TYPE_OPTIONS = [
  { value: "CPF", label: "CPF" },
  { value: "CNPJ", label: "CNPJ" },
] as const satisfies readonly { value: DocType; label: string }[];

const CONTACT_TYPE_OPTIONS = [
  { value: "CUSTOMER", label: "Cliente" },
  { value: "SUPPLIER", label: "Fornecedor" },
  { value: "BOTH", label: "Ambos" },
] as const;

function SegmentedChoice<TValue extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: readonly { value: TValue; label: string }[];
  value: string;
  onChange: (value: TValue) => void;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "flex rounded-full border border-border bg-card p-0.5 font-medium",
        size === "sm" ? "text-[11px]" : "h-9 w-full text-sm",
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-full transition-colors",
            size === "sm" ? "px-2 py-0.5" : "flex-1",
            value === option.value ? "bg-info text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ContactFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function maskCPF(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskCNPJ(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function maskDocument(value: string, type: DocType): string {
  return type === "CPF" ? maskCPF(value) : maskCNPJ(value);
}

/** Detecta o tipo a partir da qtd de dígitos (usado ao importar contatos). */
function detectDocType(value: string): DocType {
  return value.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF";
}

type DocStatus = "idle" | "valid" | "invalid" | "loading";

// ── External contact type ─────────────────────────────────────────────────────

interface ExternalContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  source: "lead" | "forge";
  sourceLabel: string;
}

// ── ImportCombobox ────────────────────────────────────────────────────────────

function ImportCombobox({
  onSelect,
}: {
  onSelect: (c: ExternalContact) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const ref = useRef<HTMLDivElement>(null);

  const { data, isFetching } = useExternalContacts(debouncedQuery || undefined);
  const contacts = data?.contacts ?? [];

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          className="pl-8 h-8 text-sm"
          placeholder="Buscar em leads e Forge..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
          {isFetching ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              Buscando...
            </div>
          ) : contacts.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              Nenhum resultado
            </div>
          ) : (
            <ul className="max-h-56 overflow-y-auto">
              {contacts.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      onSelect(c);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <div
                      className={cn(
                        "mt-0.5 size-5 rounded flex items-center justify-center shrink-0 text-[10px] font-bold",
                        c.source === "forge"
                          ? "bg-info/20 text-info"
                          : "bg-info/20 text-info",
                      )}
                    >
                      {c.source === "forge" ? "F" : "T"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">
                        {c.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.sourceLabel}
                        {c.email ? ` · ${c.email}` : ""}
                        {c.phone ? ` · ${formatPhoneWithCountry(c.phone)}` : ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── DocumentInput ─────────────────────────────────────────────────────────────

function DocumentInput({
  value,
  docType,
  onChange,
  onNameFromCNPJ,
  leading,
}: {
  value: string;
  docType: DocType;
  onChange: (v: string) => void;
  onNameFromCNPJ?: (name: string) => void;
  /** Fica dentro do campo, à esquerda (o seletor CPF/CNPJ). */
  leading?: React.ReactNode;
}) {
  const [status, setStatus] = useState<DocStatus>("idle");
  const digits = value.replace(/\D/g, "");
  const debouncedDigits = useDebouncedValue(digits, 600);

  const validate = useCallback(
    async (d: string) => {
      if (d.length === 0) {
        setStatus("idle");
        return;
      }
      if (docType === "CPF") {
        if (d.length < 11) {
          setStatus("idle");
          return;
        }
        setStatus(validateCPF(d) ? "valid" : "invalid");
        return;
      }
      if (d.length < 14) {
        setStatus("idle");
        return;
      }
      if (!validateCNPJ(d)) {
        setStatus("invalid");
        return;
      }
      setStatus("loading");
      try {
        const res = await fetch(`https://receitaws.com.br/v1/cnpj/${d}`, {
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.status === "ERROR") {
            setStatus("invalid");
          } else {
            setStatus("valid");
            if (json.nome && onNameFromCNPJ) onNameFromCNPJ(json.nome);
          }
        } else {
          // API indisponível — aceita se estrutura válida
          setStatus("valid");
        }
      } catch {
        setStatus("valid");
      }
    },
    [onNameFromCNPJ, docType],
  );

  useEffect(() => {
    validate(debouncedDigits);
  }, [debouncedDigits, validate]);

  return (
    <div className="relative">
      {leading && <div className="absolute left-1.5 top-1/2 z-10 -translate-y-1/2">{leading}</div>}
      <Input
        placeholder={
          docType === "CPF" ? "000.000.000-00" : "00.000.000/0001-00"
        }
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(maskDocument(e.target.value, docType))}
        className={cn(
          "pr-8",
          Boolean(leading) && "pl-24",
          status === "valid" &&
            "border-success focus-visible:ring-success/30",
          status === "invalid" &&
            "border-destructive focus-visible:ring-destructive/30",
        )}
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
        {status === "loading" && (
          <OrbitaSpinner className="size-4 text-muted-foreground " />
        )}
        {status === "valid" && (
          <CheckCircle2 className="size-4 text-success" />
        )}
        {status === "invalid" && <XCircle className="size-4 text-destructive" />}
      </div>
    </div>
  );
}

// ── ContactsTab ───────────────────────────────────────────────────────────────

type ContactRow = {
  id: string;
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  contactType?: string | null;
  notes?: string | null;
} & Partial<Record<keyof ContactAddress, string | null>>;

export function ContactsTab() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [docType, setDocType] = useState<DocType>("CPF");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactType, setContactType] = useState("BOTH");
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState<ContactAddress>(EMPTY_CONTACT_ADDRESS);

  const debouncedSearch = useDebouncedValue(search.trim(), PAYMENT_SEARCH_DEBOUNCE_MS);

  // Novo termo de busca reinicia a paginação (ajuste em render, não em efeito).
  const [lastSearch, setLastSearch] = useState(debouncedSearch);
  if (debouncedSearch !== lastSearch) {
    setLastSearch(debouncedSearch);
    setPage(1);
  }

  const { data, isLoading } = usePaymentContacts(
    debouncedSearch || undefined,
    undefined,
    { page, perPage: PAYMENT_PAGE_SIZE },
  );
  const createContact = useCreatePaymentContact();
  const updateContact = useUpdatePaymentContact();
  const deleteContact = useDeletePaymentContact();

  const isEditing = editingId !== null;

  function openFormWithData(c: {
    name: string;
    email?: string | null;
    phone?: string | null;
    document?: string | null;
  }) {
    const type = detectDocType(c.document ?? "");
    setEditingId(null);
    setName(c.name);
    setEmail(c.email ?? "");
    setPhone(toInternationalPhoneDigits(c.phone));
    setDocType(type);
    setDocument(c.document ? maskDocument(c.document, type) : "");
    setContactType("CUSTOMER");
    setNotes("");
    setAddress(EMPTY_CONTACT_ADDRESS);
    setShowForm(true);
  }

  function openEdit(contact: ContactRow) {
    const type = detectDocType(contact.document ?? "");
    setEditingId(contact.id);
    setName(contact.name);
    setEmail(contact.email ?? "");
    setPhone(toInternationalPhoneDigits(contact.phone));
    setDocType(type);
    setDocument(contact.document ? maskDocument(contact.document, type) : "");
    setContactType(contact.contactType ?? "BOTH");
    setNotes(contact.notes ?? "");
    setAddress(toContactAddress(contact));
    setShowForm(true);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setDocument("");
    setDocType("CPF");
    setEmail("");
    setPhone("");
    setNotes("");
    setContactType("BOTH");
    setAddress(EMPTY_CONTACT_ADDRESS);
  }

  // Troca de tipo re-aplica a máscara correta ao valor já digitado (trunca dígitos
  // excedentes quando muda CNPJ→CPF).
  function handleDocTypeChange(type: DocType) {
    setDocType(type);
    setDocument((prev) => maskDocument(prev, type));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Nome obrigatório");

    const digits = document.replace(/\D/g, "");
    if (digits.length > 0) {
      if (docType === "CPF" && !validateCPF(digits)) {
        return toast.error("CPF inválido");
      }
      if (docType === "CNPJ" && !validateCNPJ(digits)) {
        return toast.error("CNPJ inválido");
      }
    }

    try {
      if (editingId !== null) {
        await updateContact.mutateAsync({
          id: editingId,
          name,
          document: digits || null,
          email: email || null,
          phone: phone || null,
          contactType,
          notes: notes || null,
          ...toContactAddressInput(address),
        });
        toast.success("Contato atualizado!");
      } else {
        await createContact.mutateAsync({
          name,
          document: digits || undefined,
          email: email || undefined,
          phone: phone || undefined,
          contactType,
          notes: notes || undefined,
          ...toContactAddressInput(address),
        });
        toast.success("Contato criado!");
      }
      setShowForm(false);
      resetForm();
    } catch (error) {
      toast.error(
        describePaymentError(
          error,
          isEditing
            ? "Não foi possível atualizar o contato"
            : "Não foi possível criar o contato",
        ),
      );
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteContact.mutateAsync({ id: deleteTarget.id });
      toast.success("Contato removido");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(describePaymentError(error, "Não foi possível remover o contato"));
    }
  }

  const contacts = data?.contacts ?? [];
  const totalContacts = data?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Buscar contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <PaymentPaginationNav
            page={page}
            total={totalContacts}
            perPage={PAYMENT_PAGE_SIZE}
            onPageChange={setPage}
            isLoading={isLoading}
          />
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="h-9 w-full gap-1.5 bg-info text-white hover:bg-info/90 sm:w-auto"
          >
            <Plus className="size-4" /> Novo Contato
          </Button>
        </div>
      </div>

      {/* Importar de Leads/Forge */}
      <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Zap className="size-3.5 text-info" />
          Importar de Tracking ou Forge
        </div>
        <ImportCombobox onSelect={openFormWithData} />
        <p className="text-xs text-muted-foreground">
          Selecione um lead existente para preencher os campos automaticamente.
        </p>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-border/50">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">
                Nome
              </th>
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">
                Tipo
              </th>
              <th className="hidden lg:table-cell text-left px-4 py-3 text-xs text-muted-foreground font-medium">
                Documento
              </th>
              <th className="hidden lg:table-cell text-left px-4 py-3 text-xs text-muted-foreground font-medium">
                E-mail
              </th>
              <th className="hidden lg:table-cell text-left px-4 py-3 text-xs text-muted-foreground font-medium">
                Telefone
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-12 text-center text-muted-foreground text-sm"
                >
                  Carregando...
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-12 text-center text-muted-foreground text-sm"
                >
                  <Users className="size-8 mx-auto mb-2 opacity-30" />
                  Nenhum contato cadastrado
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {CONTACT_TYPE_LABELS[c.contactType] ?? c.contactType}
                    </Badge>
                  </td>
                  <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground">
                    {c.document ?? "—"}
                  </td>
                  <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground">
                    {c.email ?? "—"}
                  </td>
                  <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground">
                    {c.phone ? formatPhoneWithCountry(c.phone) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => openEdit(c)}
                          className="gap-2"
                        >
                          <Pencil className="size-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            setDeleteTarget({ id: c.id, name: c.name })
                          }
                          className="gap-2 text-destructive"
                        >
                          <Trash2 className="size-4" /> Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      <PaymentPagination
        page={page}
        total={totalContacts}
        perPage={PAYMENT_PAGE_SIZE}
        onPageChange={setPage}
        itemLabel="contato"
        isLoading={isLoading}
      />

      {/* Dialog de criação */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent scrollable className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Editar Contato" : "Novo Contato"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="space-y-6">
              <ContactFormSection title="Dados do contato">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="contact-name">Nome *</Label>
                    <Input
                      id="contact-name"
                      placeholder="Nome completo ou razão social"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Documento</Label>
                    <DocumentInput
                      value={document}
                      docType={docType}
                      onChange={setDocument}
                      onNameFromCNPJ={(n) => {
                        if (!name.trim()) setName(n);
                      }}
                      leading={
                        <SegmentedChoice
                          size="sm"
                          options={DOC_TYPE_OPTIONS}
                          value={docType}
                          onChange={handleDocTypeChange}
                        />
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <SegmentedChoice
                      options={CONTACT_TYPE_OPTIONS}
                      value={contactType}
                      onChange={setContactType}
                    />
                  </div>
                </div>
              </ContactFormSection>
              <ContactFormSection title="Contato">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-email">E-mail</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="nome@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-phone">Telefone</Label>
                    <PhoneCountryInput id="contact-phone" key={editingId ?? "new"} value={phone} onChange={setPhone} />
                  </div>
                </div>
              </ContactFormSection>
              <ContactFormSection
                title="Endereço de cobrança"
                description="Necessário para emitir boleto. Digite o CEP e o resto se preenche."
              >
                <ContactAddressFields address={address} onChange={setAddress} />
              </ContactFormSection>
              <ContactFormSection title="Observações">
                <Textarea
                  rows={2}
                  placeholder="Algo que a equipe precisa saber sobre este contato"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="max-h-32 overflow-y-auto scroll-cols-tracking resize-none"
                />
              </ContactFormSection>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createContact.isPending || updateContact.isPending}
                className="min-w-36 bg-info hover:bg-info/90 text-white"
              >
                {createContact.isPending || updateContact.isPending
                  ? "Salvando..."
                  : isEditing
                    ? "Salvar Alterações"
                    : "Criar Contato"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleteContact.isPending) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover contato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover
              {deleteTarget ? ` "${deleteTarget.name}"` : ""}? Essa ação pode
              ser desfeita reativando o contato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteContact.isPending}>
              Cancelar
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteContact.isPending}
              onClick={handleConfirmDelete}
            >
              {deleteContact.isPending ? "Removendo..." : "Remover"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
