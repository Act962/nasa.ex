"use client";

import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, ImageOff } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCents } from "../utils/campaign";
import { useStarFriendsCampaignReceipts, type CampaignReceiptFilter } from "../hooks/use-star-friends-campaign";

const FILTERS: { value: CampaignReceiptFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "ACCEPTED", label: "Aceitos" },
  { value: "FLAGGED", label: "Com alerta" },
  { value: "DUPLICATE", label: "Repetidos" },
  { value: "REJECTED", label: "Recusados" },
  { value: "VOIDED", label: "Anulados" },
];

const STATUS_LABELS = { ACCEPTED: "Aceito", DUPLICATE: "Repetido", REJECTED: "Recusado", VOIDED: "Anulado" } as const;
const STATUS_STYLES = {
  ACCEPTED: "bg-success/15 text-success",
  DUPLICATE: "bg-warning/15 text-warning",
  REJECTED: "bg-destructive/15 text-destructive",
  VOIDED: "bg-muted text-muted-foreground",
} as const;

export function CampaignReceipts({ campaignId }: { campaignId: string }) {
  const [filter, setFilter] = useState<CampaignReceiptFilter>("ALL");
  const receiptsQuery = useStarFriendsCampaignReceipts(campaignId, filter);
  const receipts = receiptsQuery.data?.pages.flatMap((page) => page.receipts) ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="scroll-hidden-x -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {FILTERS.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={filter === option.value ? "default" : "outline"}
            className="shrink-0 rounded-full"
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {receiptsQuery.isLoading && <OrbitaSpinner className="mx-auto my-6 size-5" />}
      {!receiptsQuery.isLoading && receipts.length === 0 && (
        <p className="rounded-[18px] border border-dashed border-line p-6 text-center text-sm text-muted-foreground">Nenhum cupom por aqui ainda.</p>
      )}
      <ul className="grid gap-3 md:grid-cols-2">
        {receipts.map((receipt) => (
          <li key={receipt.id} className="flex gap-3 rounded-[18px] border border-line bg-card p-3">
            {receipt.photoUrl && receipt.mimetype?.startsWith("image/") ? (
              <a href={receipt.photoUrl} target="_blank" rel="noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receipt.photoUrl} alt="Foto do cupom" className="h-24 w-16 rounded-lg object-cover" />
              </a>
            ) : (
              <a
                href={receipt.photoUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="grid h-24 w-16 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"
              >
                <ImageOff className="size-4" />
              </a>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold">{receipt.member.name}</span>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLES[receipt.status])}>
                  {STATUS_LABELS[receipt.status]}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {receipt.member.phone} · enviado em {format(new Date(receipt.createdAt), "dd/MM HH:mm")}
              </span>
              <span>
                {receipt.totalCents !== null ? formatCents(receipt.totalCents) : "Valor não lido"}
                {receipt.issuedAt ? ` · compra em ${format(new Date(receipt.issuedAt), "dd/MM/yyyy HH:mm")}` : ""}
              </span>
              {receipt.luckyNumbers.length > 0 && (
                <span className="text-xs">
                  Números:{" "}
                  {receipt.luckyNumbers.map((luckyNumber) => (
                    <span key={luckyNumber.code} className={cn("mr-1 font-mono", luckyNumber.status === "VOIDED" && "text-muted-foreground line-through")}>
                      {luckyNumber.code}
                    </span>
                  ))}
                </span>
              )}
              {receipt.rejectReason && <span className="text-xs text-muted-foreground">{receipt.rejectReason}</span>}
              {receipt.isFlagged && (
                <span className="flex items-start gap-1 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" /> {receipt.flagReasons.join(" · ")}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {receiptsQuery.hasNextPage && (
        <Button variant="outline" className="self-center rounded-full" onClick={() => receiptsQuery.fetchNextPage()} disabled={receiptsQuery.isFetchingNextPage}>
          Ver mais
        </Button>
      )}
    </div>
  );
}
