"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrgRole } from "@/hooks/use-org-role";
import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, EllipsisVertical, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CreateInviteLinkDialog } from "./create-invite-link-dialog";

function buildLinkUrl(token: string) {
  const base =
    (typeof window !== "undefined" && window.location.origin) ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "";
  return `${base}/join/${token}`;
}

function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getStatus(link: { revokedAt: Date | string | null; expiresAt: Date | string }) {
  if (link.revokedAt) return "revoked" as const;
  const exp = typeof link.expiresAt === "string" ? new Date(link.expiresAt) : link.expiresAt;
  if (exp.getTime() < Date.now()) return "expired" as const;
  return "active" as const;
}

export function InviteLinksTab() {
  const { canManage } = useOrgRole();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: links = [], isLoading } = useQuery(
    orpc.inviteLinks.list.queryOptions(),
  );

  const revoke = useMutation({
    mutationFn: (id: string) => orpc.inviteLinks.revoke.call({ id }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Link revogado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao revogar link"),
  });

  const del = useMutation({
    mutationFn: (id: string) => orpc.inviteLinks.delete.call({ id }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Link deletado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao deletar link"),
  });

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(buildLinkUrl(token));
    toast.success("Link copiado");
  };

  return (
    <div className="space-y-6">
      <div className="w-full flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Links de Convite
          </h2>
          <p className="text-sm text-foreground/50">
            Gere links compartilháveis para adicionar membros à organização.
          </p>
        </div>

        {canManage && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" /> Criar Link
          </Button>
        )}
      </div>

      <div>
        <span className="text-muted-foreground text-xs">
          {links.length} links
        </span>
      </div>

      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cargo</TableHead>
              <TableHead>Expira em</TableHead>
              <TableHead>Criado por</TableHead>
              <TableHead>Usos</TableHead>
              <TableHead>Stars ao entrar</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground text-sm">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && links.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground text-sm">
                  Nenhum link criado ainda.
                </TableCell>
              </TableRow>
            )}
            {links.map((link) => {
              const status = getStatus(link);
              return (
                <TableRow key={link.id}>
                  <TableCell>
                    <Badge variant="outline">{link.role}</Badge>
                  </TableCell>
                  <TableCell>{formatDate(link.expiresAt)}</TableCell>
                  <TableCell className="text-sm">
                    {link.createdBy?.name ?? "—"}
                  </TableCell>
                  <TableCell>{link.usesCount}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Star className="size-3.5 text-amber-400" />
                      {link.starsOnJoin}
                    </span>
                  </TableCell>
                  <TableCell>
                    {status === "active" && (
                      <Badge className="bg-emerald-600/20 text-emerald-400">
                        Ativo
                      </Badge>
                    )}
                    {status === "expired" && (
                      <Badge variant="outline">Expirado</Badge>
                    )}
                    {status === "revoked" && (
                      <Badge variant="destructive">Revogado</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-xs" variant="ghost">
                          <EllipsisVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Opções</DropdownMenuLabel>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => copyLink(link.token)}
                        >
                          <Copy className="size-4" />
                          Copiar Link
                        </DropdownMenuItem>
                        {canManage && status === "active" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="cursor-pointer"
                              variant="destructive"
                              onClick={() => revoke.mutate(link.id)}
                            >
                              Revogar Link
                            </DropdownMenuItem>
                          </>
                        )}
                        {canManage && status === "revoked" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="cursor-pointer"
                              variant="destructive"
                              onClick={() => del.mutate(link.id)}
                            >
                              <Trash2 className="size-4" />
                              Deletar Link
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <CreateInviteLinkDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => qc.invalidateQueries()}
      />
    </div>
  );
}
