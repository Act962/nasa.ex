"use client";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { phoneMaskFull } from "@/utils/format-phone";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useBroadcastRecipients,
  useRemoveRecipient,
} from "../hooks/use-broadcast-audience";
import { RECIPIENT_STATUS_LABEL } from "../lib/broadcast-status";

export function RecipientsTable({ broadcastId }: { broadcastId: string }) {
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useBroadcastRecipients(broadcastId);
  const removeRecipient = useRemoveRecipient(broadcastId);

  const recipients = data?.pages.flatMap((page) => page.recipients) ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (recipients.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        Nenhum destinatário ainda. Adicione via aba Leads ou CSV.
      </div>
    );
  }

  function handleRemove(recipientId: string) {
    removeRecipient.mutate(
      { broadcastId, recipientId },
      {
        onError: (error) =>
          toast.error(error.message ?? "Falha ao remover destinatário"),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipients.map((recipient) => (
              <TableRow key={recipient.id}>
                <TableCell>{recipient.name ?? "—"}</TableCell>
                <TableCell className="tabular-nums">
                  {phoneMaskFull(recipient.phone)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {RECIPIENT_STATUS_LABEL[recipient.status] ??
                      recipient.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(recipient.id)}
                    disabled={removeRecipient.isPending}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Carregando…" : "Carregar mais"}
          </Button>
        </div>
      )}
    </div>
  );
}
