"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStarFriendsMembers } from "../hooks/use-star-friends";

export function MembersList({ onOpenHistory }: { onOpenHistory: (memberId: string) => void }) {
  const [search, setSearch] = useState("");
  const members = useStarFriendsMembers(search);
  const rows = members.data?.pages.flatMap((page) => page.members) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Input
        className="max-w-sm"
        placeholder="Buscar por nome ou telefone"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
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
              <TableCell className="text-right font-semibold text-amber-500">{member.balance}</TableCell>
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
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Nenhum participante ainda — eles entram na primeira compra paga.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {members.hasNextPage && (
        <Button variant="outline" className="w-fit" onClick={() => members.fetchNextPage()}>
          Carregar mais
        </Button>
      )}
    </div>
  );
}
