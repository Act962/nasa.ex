"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useQueryFormById } from "@/features/form/hooks/use-form";
import { useFormRecordLookup } from "@/features/form-records/hooks/use-form-record-lookup";

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Entrada de uma ficha nova sem cliente escolhido (spec 0075, RF-8): busca o
 * cliente e segue para o preenchimento de sempre, já no contexto dele.
 */
export function RecordClientPicker({ formId }: { formId: string }) {
  const router = useRouter();
  const { form, isLoading: isFormLoading } = useQueryFormById({ formId });
  const [text, setText] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

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
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{form?.name ?? "Nova ficha"}</h1>
        <p className="text-sm text-muted-foreground">Para qual cliente é esta ficha?</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={text}
          placeholder="Buscar cliente pelo nome ou telefone"
          aria-label="Buscar cliente"
          onChange={(event) => setText(event.target.value)}
          className="pl-9"
        />
      </div>
      {lookup.isLoading && <p className="text-sm text-muted-foreground">Buscando...</p>}
      {lookup.isError && (
        <p className="text-sm text-muted-foreground">Não consegui buscar os clientes. Recarregue a página.</p>
      )}
      {!lookup.isLoading && !lookup.isError && clients.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum cliente encontrado. Cadastre o cliente em Contatos e volte aqui.
        </p>
      )}
      <ul className="divide-y rounded-md border empty:hidden">
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
