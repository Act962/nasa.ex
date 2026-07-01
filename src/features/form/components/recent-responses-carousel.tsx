"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Search, User } from "lucide-react";
import { orpc } from "@/lib/orpc";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { FormFirstGroupThumbnail } from "./form-first-group-thumbnail";

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

interface ResponseItem {
  id: string;
  createdAt: Date | string;
  label: string | null;
  form: {
    id: string;
    name: string;
    jsonBlock: string;
    settings: {
      backgroundColor: string | null;
      backgroundImage: string | null;
      primaryColor: string | null;
    } | null;
  };
  lead: {
    id: string;
    name: string;
    status: { id: string; name: string; color: string | null } | null;
    tracking: { id: string; name: string } | null;
    responsible: { id: string; name: string; image: string | null } | null;
  } | null;
}

export function RecentResponsesCarousel() {
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");

  // Debounce 300ms — evita disparar query a cada tecla.
  useEffect(() => {
    const id = setTimeout(() => setQuery(rawQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [rawQuery]);

  const { data, isLoading, isError } = useQuery({
    ...orpc.form.listRecentResponses.queryOptions({
      input: { query: query || undefined, limit: 24 },
    }),
    staleTime: 30_000,
  });

  const responses = (data?.responses ?? []) as ResponseItem[];

  return (
    <section className="w-full min-w-0 pt-7 pb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h5 className="text-xl font-semibold tracking-tight">
          Últimos formulários preenchidos
        </h5>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Buscar por formulário, lead ou título da resposta…"
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <CarouselSkeleton />
      ) : isError ? (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar as respostas recentes.
        </p>
      ) : responses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {query
            ? "Nenhum formulário preenchido bate com a busca."
            : "Nenhum formulário foi preenchido ainda."}
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto scroll-cols-tracking pb-2">
          {responses.map((r) => (
            <ResponseCard key={r.id} response={r} />
          ))}
        </div>
      )}
    </section>
  );
}

function ResponseCard({ response }: { response: ResponseItem }) {
  const createdAt = useMemo(
    () => new Date(response.createdAt),
    [response.createdAt],
  );
  const formTitle = truncate(response.form.name, 14);
  const responsibleImg = useConstructUrl(
    response.lead?.responsible?.image || "",
  );
  const status = response.lead?.status ?? null;
  const tracking = response.lead?.tracking ?? null;
  const responsible = response.lead?.responsible ?? null;
  // Slug é cosmético na rota /formulario/<slug>/<responseId> — page usa só responseId.
  const href = `/formulario/${response.form.id}/${response.id}`;

  return (
    <Link
      href={href}
      className="group flex w-72 shrink-0 flex-col gap-2 rounded-xl border border-border bg-card p-3 transition-all hover:border-violet-400 hover:shadow-md"
    >
      <FormFirstGroupThumbnail
        jsonBlock={response.form.jsonBlock}
        settings={response.form.settings}
      />

      <div className="flex items-start justify-between gap-2">
        <h3
          className="text-sm font-semibold leading-tight"
          title={response.form.name}
        >
          {formTitle}
        </h3>
        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
          <Calendar className="size-3" />
          {dateFmt.format(createdAt)} {timeFmt.format(createdAt)}
        </span>
      </div>

      {/* Campo(s) marcados como "Usar valor como título da resposta" —
          armazenados em `FormResponses.label` (derivado server-side). */}
      {response.label && (
        <div className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-900 dark:border-violet-800/40 dark:bg-violet-900/20 dark:text-violet-200">
          <span className="line-clamp-1">{response.label}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs">
        <User className="size-3 text-muted-foreground" />
        <span className="truncate" title={response.lead?.name ?? "Sem lead"}>
          {response.lead?.name ?? "Sem lead"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        {tracking?.name && (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium">
            {tracking.name}
          </span>
        )}
        {status?.name && (
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium"
            style={{
              borderColor: status.color || undefined,
              color: status.color || undefined,
              background: status.color ? `${status.color}15` : undefined,
            }}
          >
            <span
              className="inline-block size-1.5 rounded-full"
              style={{ background: status.color || "#888" }}
            />
            {status.name}
          </span>
        )}
      </div>

      {responsible && (
        <div className="mt-auto flex items-center gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
          {responsible.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={responsibleImg}
              alt={responsible.name}
              className="size-5 rounded-full border object-cover"
            />
          ) : (
            <span className="flex size-5 items-center justify-center rounded-full bg-foreground/10 text-[9px] font-semibold">
              {(responsible.name ?? "?").slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="truncate">{responsible.name}</span>
        </div>
      )}
    </Link>
  );
}

function CarouselSkeleton() {
  return (
    <div className="max-w-full overflow-hidden pb-3">
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex w-72 shrink-0 flex-col gap-2 rounded-xl border border-border bg-card p-3",
            )}
          >
            <Skeleton className="aspect-[2/1] w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
