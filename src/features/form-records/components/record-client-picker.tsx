"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useQueryFormById } from "@/features/form/hooks/use-form";
import { useFormRecordLookup, useQuickClientDefaults } from "@/features/form-records/hooks/use-form-record-lookup";
import { useCreateLead } from "@/features/leads/hooks/use-lead";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_PHONE_DIGITS = 8;

/** Cadastro do cliente na hora, sem sair para o tracking: nome e telefone bastam. */
function QuickClientForm({ formId, initialName, onCreated, onCancel }: { formId: string; initialName: string; onCreated: (leadId: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const defaults = useQuickClientDefaults(formId, true);
  const createLead = useCreateLead();
  const phoneDigits = phone.replace(/\D/g, "");
  const trackingId = defaults.data?.trackingId;
  const statusId = defaults.data?.statusId;
  const canSave = name.trim().length >= 2 && phoneDigits.length >= MIN_PHONE_DIGITS && Boolean(trackingId && statusId) && !createLead.isPending;

  const save = () => {
    if (!trackingId || !statusId) return;
    createLead.mutate({ name: name.trim(), phone: phoneDigits, trackingId, statusId }, { onSuccess: (result) => onCreated(result.lead.id) });
  };

  return (
    <div className="space-y-3 rounded-[20px] border bg-card p-4">
      <p className="text-sm font-medium">Novo cliente</p>
      <div className="space-y-1">
        <Label htmlFor="quick-client-name">Nome</Label>
        <Input id="quick-client-name" value={name} maxLength={120} autoFocus className="h-11" onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="quick-client-phone">Telefone com DDD</Label>
        <Input id="quick-client-phone" value={phone} inputMode="tel" maxLength={20} placeholder="(86) 99999-9999" className="h-11" onChange={(event) => setPhone(event.target.value)} />
      </div>
      {defaults.data && !trackingId && (
        <p className="text-xs text-destructive">Você ainda não participa de nenhum tracking. Peça acesso a um gestor para cadastrar clientes.</p>
      )}
      {defaults.data?.trackingName && <p className="text-xs text-muted-foreground">O cliente entra no tracking {defaults.data.trackingName}.</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" className="h-11 sm:h-9" disabled={!canSave} onClick={save}>
          {createLead.isPending ? "Cadastrando..." : "Cadastrar e continuar"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Entrada de uma ficha nova sem cliente escolhido (spec 0075, RF-8): busca o
 * cliente e segue para o preenchimento de sempre, já no contexto dele.
 */
export function RecordClientPicker({ formId }: { formId: string }) {
  const router = useRouter();
  const { form, isLoading: isFormLoading } = useQueryFormById({ formId });
  const [text, setText] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isCreatingClient, setIsCreatingClient] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(text.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const lookup = useFormRecordLookup({ source: "LEADS", query: debouncedQuery, enabled: true });
  const clients = lookup.data?.options ?? [];

  if (isFormLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 bg-background px-4 py-8">
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => router.push(`/form/responses/${formId}`)}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-knob transition-colors hover:bg-panel"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="min-w-0 space-y-1">
          <h1 className="break-words text-xl font-semibold">{form?.name ?? "Nova ficha"}</h1>
          <p className="text-sm text-muted-foreground">Para qual cliente é esta ficha?</p>
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={text}
          placeholder="Buscar cliente pelo nome ou telefone"
          aria-label="Buscar cliente"
          onChange={(event) => setText(event.target.value)}
          className="h-11 pl-9"
        />
      </div>
      {isCreatingClient ? (
        <QuickClientForm
          formId={formId}
          initialName={text.trim()}
          onCancel={() => setIsCreatingClient(false)}
          onCreated={(leadId) => router.push(`/formulario/novo/${formId}/${leadId}`)}
        />
      ) : (
        <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setIsCreatingClient(true)}>
          <UserPlus className="size-4" />
          Cadastrar novo cliente
        </Button>
      )}
      {lookup.isLoading && <p className="text-sm text-muted-foreground">Buscando...</p>}
      {lookup.isError && (
        <p className="text-sm text-muted-foreground">Não consegui buscar os clientes. Recarregue a página.</p>
      )}
      {!lookup.isLoading && !lookup.isError && clients.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum cliente encontrado. Use &quot;Cadastrar novo cliente&quot; acima.
        </p>
      )}
      <ul className="divide-y overflow-hidden rounded-[20px] border empty:hidden">
        {clients.map((client) => (
          <li key={client.id}>
            <button
              type="button"
              onClick={() => router.push(`/formulario/novo/${formId}/${client.id}`)}
              className="flex w-full flex-col items-start px-3 py-3 text-left hover:bg-accent"
            >
              <span className="break-words text-sm font-medium">{client.label}</span>
              {client.detail && <span className="text-xs text-muted-foreground">{client.detail}</span>}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
