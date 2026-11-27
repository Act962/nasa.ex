"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, ExternalLink, Link2, Receipt, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { formatDecimalToMoney } from "@/utils/mask-money";
import { phoneMaskFull } from "@/utils/format-phone";
import { useSaleReceipts } from "@/features/forge/hooks/use-forge-sales";
import { describeSalePayment } from "@/features/forge/lib/sale-payment";

const SEARCH_DEBOUNCE_MS = 300;

function receiptUrl(publicToken: string) {
  return `${window.location.origin}/proposta/${publicToken}/recibo`;
}

function formatPaidAt(paidAt: Date | null) {
  if (!paidAt) return "";
  return new Date(paidAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function CopyReceiptLink({ publicToken }: { publicToken: string }) {
  const [isCopied, setIsCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="gap-1"
      onClick={async () => {
        await navigator.clipboard.writeText(receiptUrl(publicToken));
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }}
    >
      {isCopied ? <Check className="size-4" /> : <Link2 className="size-4" />}
      {isCopied ? "Copiado" : "Copiar link"}
    </Button>
  );
}

/** "Meus recibos" (spec 0151, RF-13): lista de todos os recibos emitidos pela empresa. */
export function ReceiptsListPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const { data, isLoading } = useSaleReceipts({ search: debouncedSearch, page });
  const receipts = data?.receipts ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4 md:px-6 md:py-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar ao Forge">
          <Link href="/forge">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Receipt className="size-5" /> Meus recibos
          </h1>
          <p className="text-sm text-muted-foreground">{data ? `${data.total} recibo${data.total === 1 ? "" : "s"} emitido${data.total === 1 ? "" : "s"}` : " "}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por cliente, WhatsApp ou nº do recibo"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : receipts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {debouncedSearch ? "Nenhum recibo encontrado para essa busca." : "Nenhum recibo emitido ainda. Emita pelo chat (+ › Recibos) ou em Propostas › Registrar venda."}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {receipts.map((receipt) => (
            <li key={receipt.id}>
              <Card className="py-3">
                <CardContent className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-0.5">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-semibold">Nº {String(receipt.number).padStart(4, "0")}</span>
                      <span className="truncate">{receipt.clientName ?? "Cliente"}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        formatPaidAt(receipt.paidAt),
                        describeSalePayment(receipt.paymentMethod, receipt.installments),
                        receipt.clientPhone ? phoneMaskFull(receipt.clientPhone) : null,
                        receipt.responsibleName ? `por ${receipt.responsibleName}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <span className="text-base font-bold tabular-nums text-success">{formatDecimalToMoney(receipt.total)}</span>
                    <div className="flex gap-2">
                      <CopyReceiptLink publicToken={receipt.publicToken} />
                      <Button asChild size="sm" variant="ghost" aria-label="Abrir recibo">
                        <a href={`/proposta/${receipt.publicToken}/recibo`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {data && (page > 1 || data.hasMore) ? (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button type="button" variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="size-4" /> Anteriores
          </Button>
          <span className="text-sm text-muted-foreground">Página {page}</span>
          <Button type="button" variant="outline" size="sm" disabled={!data.hasMore} onClick={() => setPage(page + 1)}>
            Próximos <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
