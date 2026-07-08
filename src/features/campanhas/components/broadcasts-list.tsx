"use client";

import Link from "next/link";
import { Send, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBroadcasts } from "../hooks/use-broadcasts";
import { BROADCAST_STATUS_LABEL } from "../lib/broadcast-status";
import { CreateBroadcastDialog } from "./create-broadcast-dialog";
import { CampanhasNav } from "./campanhas-nav";

export function BroadcastsList() {
  const { data: broadcasts, isLoading } = useBroadcasts();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
      <CampanhasNav />
      <div className="mb-6 mt-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Send className="size-5" /> Campanhas
          </h1>
          <p className="text-sm text-muted-foreground">
            Disparos em massa via WhatsApp API Oficial.
          </p>
        </div>
        <CreateBroadcastDialog />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : !broadcasts || broadcasts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Users className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Nenhuma campanha ainda</p>
            <p className="text-sm text-muted-foreground">
              Crie sua primeira campanha para montar uma audiência.
            </p>
          </div>
          <CreateBroadcastDialog />
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Destinatários</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {broadcasts.map((broadcast) => (
                <TableRow key={broadcast.id} className="cursor-pointer">
                  <TableCell>
                    <Link
                      href={`/campanhas/${broadcast.id}`}
                      className="font-medium hover:underline"
                    >
                      {broadcast.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {broadcast.tracking.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {BROADCAST_STATUS_LABEL[broadcast.status] ??
                        broadcast.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {broadcast.totalRecipients}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
