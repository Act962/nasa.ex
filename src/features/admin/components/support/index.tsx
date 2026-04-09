"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LifeBuoy,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { APPS } from "@/features/apps/components/apps-data";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ViewSupportSheet } from "./view-support-sheet";
import { useListSupportTickets } from "@/features/admin/hooks/use-suport";

function ImageLink({ imageUrl }: { imageUrl: string }) {
  const fullUrl = useConstructUrl(imageUrl);
  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors bg-secondary w-fit px-2 py-1 rounded-md"
    >
      <ImageIcon className="size-3" />
      Ver Anexo
    </a>
  );
}

export function SupportPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const pageParam = searchParams.get("page");
  const page = pageParam ? Number(pageParam) : 1;
  const take = 10;

  const { data, isLoading } = useListSupportTickets(page, take);

  const statusMap: Record<string, string> = {
    PENDING: "Pendente",
    IN_PROGRESS: "Analisando",
    RESOLVED: "Implementado",
    REJECTED: "Rejeitado",
  };

  const setPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="space-y-8 pb-10 w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <LifeBuoy className="size-4" />
            <h2 className="text-xl font-semibold">Suportes e Sugestões</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Gerencie tickets de suporte, reporte de bugs e ideias de melhorias
            enviadas pela equipe.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="dark text-foreground border border-border rounded-2xl overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Aplicativo</TableHead>
                <TableHead>Autor do Ticket</TableHead>
                <TableHead>Sugestão</TableHead>
                <TableHead>Mídia</TableHead>
                <TableHead>Enviado Em</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-40 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Loader2 className="size-8 animate-spin text-primary/50" />
                      <p className="text-sm font-medium">Carregando dados...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : !data || data.tickets.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-40 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="p-3 bg-muted rounded-full">
                        <LifeBuoy className="size-8 stroke-1 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm font-medium">
                        Nenhum chamado encontrado.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.tickets.map((ticket) => {
                  const appInfo = APPS.find((a) => a.id === ticket.appId);
                  const AppIcon = appInfo?.icon;

                  return (
                    <TableRow
                      key={ticket.id}
                      className="cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setIsSheetOpen(true);
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {AppIcon ? (
                            <div className="p-1.5 bg-muted rounded-md border border-border w-10 h-10">
                              <AppIcon />
                            </div>
                          ) : null}
                          <span className="font-medium text-[11px] tracking-wider uppercase">
                            {appInfo?.name || ticket.appId}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm text-foreground/90">
                            {ticket.user?.name || "Desconhecido"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {ticket.user?.email}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="max-w-[280px]">
                        <p
                          className="truncate text-sm text-muted-foreground"
                          title={ticket.improvement}
                        >
                          {ticket.improvement}
                        </p>
                      </TableCell>

                      <TableCell>
                        {ticket.imageUrl ? (
                          <div onClick={(e) => e.stopPropagation()}>
                            <ImageLink imageUrl={ticket.imageUrl} />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground font-medium px-2">
                            —
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-muted-foreground text-xs font-medium whitespace-nowrap">
                        {format(
                          new Date(ticket.createdAt),
                          "dd MMM yyyy 'às' HH:mm",
                          { locale: ptBR },
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            ticket.status === "PENDING"
                              ? "secondary"
                              : ticket.status === "IN_PROGRESS"
                              ? "default"
                              : ticket.status === "RESOLVED"
                              ? "outline"
                              : "destructive"
                          }
                          className={
                            ticket.status === "RESOLVED"
                              ? "bg-accent text-accent-foreground border-border"
                              : ""
                          }
                        >
                          {statusMap[ticket.status] || ticket.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginação Estilizada */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-end gap-3 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="h-8 cursor-pointer"
            >
              <ChevronLeft className="size-4 mr-1" />
              Anterior
            </Button>

            <div className="flex items-center justify-center min-w-[100px]">
              <span className="text-[13px] text-muted-foreground font-medium">
                Página <strong className="text-foreground">{page}</strong> de{" "}
                <strong className="text-foreground">{data.totalPages}</strong>
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= data.totalPages}
              className="h-8 cursor-pointer"
            >
              Próxima
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      <ViewSupportSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        ticket={selectedTicket}
      />
    </div>
  );
}
