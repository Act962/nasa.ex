"use client";

import { useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TIER_LABELS, type LoyaltyTierId } from "../utils/tiers";
import { ChevronRight, Search, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useStarFriendsMembers } from "../hooks/use-star-friends";

const EMPTY_MEMBERS_MESSAGE = "Nenhum participante ainda — eles entram na primeira compra paga.";

const TIER_CHIP_STYLES: Record<LoyaltyTierId, string> = {
  EARTH: "bg-muted text-muted-foreground",
  MOON: "bg-info/10 text-info",
  GALAXY: "bg-warning/15 text-warning",
};

function TierChip({ tier }: { tier: LoyaltyTierId | null }) {
  if (!tier) return null;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold", TIER_CHIP_STYLES[tier])}>
      {TIER_LABELS[tier]}
    </span>
  );
}

function formatLastActivity(lastActivityAt: Date | string | null): string {
  if (!lastActivityAt) return "Sem movimentação";
  return `Ativo ${formatDistanceToNow(new Date(lastActivityAt), { addSuffix: true, locale: ptBR })}`;
}

function toInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : (words[0] ?? "?").slice(0, 2);
  return initials.toUpperCase();
}

export function MembersList({ onOpenHistory }: { onOpenHistory: (memberId: string) => void }) {
  const [search, setSearch] = useState("");
  const members = useStarFriendsMembers(search);
  const rows = members.data?.pages.flatMap((page) => page.members) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full md:max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-11 rounded-full border-line bg-card pl-10"
          placeholder="Buscar por nome ou telefone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {rows.map((member) => (
          <div key={member.id} className="flex items-center gap-3 rounded-[20px] border border-line bg-card p-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
              {toInitials(member.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-medium">
                  {member.lastLeadId ? (
                    <Link href={`/contatos/${member.lastLeadId}?tab=products`}>{member.name}</Link>
                  ) : (
                    member.name
                  )}
                </span>
                <TierChip tier={member.tier} />
              </p>
              <p className="truncate text-xs text-muted-foreground">{member.phone}</p>
              <p className="truncate text-xs text-muted-foreground">{formatLastActivity(member.lastActivityAt)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="flex items-center gap-1 text-lg font-bold text-warning">
                <Star className="size-4 fill-current" />
                {member.balance}
              </span>
              <Button
                variant="ghost"
                className="h-9 rounded-full px-3 text-xs"
                onClick={() => onOpenHistory(member.id)}
              >
                Extrato <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {rows.length === 0 && !members.isLoading && (
          <p className="rounded-[20px] border border-line bg-card p-4 text-center text-sm text-muted-foreground">
            {EMPTY_MEMBERS_MESSAGE}
          </p>
        )}
      </div>

      {members.isLoading && (
        <div className="flex justify-center py-6">
          <OrbitaSpinner className="size-5 text-muted-foreground" />
        </div>
      )}

      <div className="max-md:hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Nível</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Última atividade</TableHead>
              <TableHead>Participa desde</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">
                  {member.lastLeadId ? <Link href={`/contatos/${member.lastLeadId}?tab=products`}>{member.name}</Link> : member.name}
                </TableCell>
                <TableCell>{member.phone}</TableCell>
                <TableCell>
                  <TierChip tier={member.tier} />
                </TableCell>
                <TableCell className="text-right font-semibold text-warning">{member.balance}</TableCell>
                <TableCell className="text-muted-foreground">{formatLastActivity(member.lastActivityAt)}</TableCell>
                <TableCell>{format(new Date(member.joinedAt), "dd/MM/yyyy")}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => onOpenHistory(member.id)}>
                    Extrato
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && !members.isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {EMPTY_MEMBERS_MESSAGE}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {members.hasNextPage && (
        <Button
          variant="outline"
          className="h-11 w-full rounded-full md:w-fit"
          disabled={members.isFetchingNextPage}
          onClick={() => members.fetchNextPage()}
        >
          Carregar mais
        </Button>
      )}
    </div>
  );
}
