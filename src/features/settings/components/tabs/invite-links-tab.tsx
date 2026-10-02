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
import { Copy, EllipsisVertical, Link2, Plus, Star, Trash2 } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
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

function formatDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

type InviteLinkStatus = "active" | "expired" | "revoked";

function getStatus(link: {
  revokedAt: Date | string | null;
  expiresAt: Date | string;
}): InviteLinkStatus {
  if (link.revokedAt) return "revoked" as const;
  const expiresAt =
    typeof link.expiresAt === "string" ? new Date(link.expiresAt) : link.expiresAt;
  if (expiresAt.getTime() < Date.now()) return "expired" as const;
  return "active" as const;
}

export function InviteLinksTab() {
  const { canManage } = useOrgRole();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: links = [], isLoading } = useQuery(
    orpc.inviteLinks.list.queryOptions(),
  );

  const revokeLinkMutation = useMutation({
    mutationFn: (id: string) => orpc.inviteLinks.revoke.call({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Link revogado");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Erro ao revogar link"),
  });

  const deleteLinkMutation = useMutation({
    mutationFn: (id: string) => orpc.inviteLinks.delete.call({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Link excluído");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Erro ao excluir link"),
  });

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(buildLinkUrl(token));
    toast.success("Link copiado");
  };

  return (
    <div className="space-y-6">
      <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="max-md:hidden">
          <h2 className="text-2xl font-bold text-foreground">Links de convite</h2>
          <p className="text-sm text-muted-foreground">
            Crie um link e envie para quem deve entrar na empresa.
          </p>
        </div>

        {canManage && (
          <Button
            onClick={() => setDialogOpen(true)}
            className="h-11 w-full rounded-full md:h-9 md:w-auto"
          >
            <Plus className="size-4" /> Criar link
          </Button>
        )}
      </div>

      <div>
        <span className="text-muted-foreground text-xs">
          {links.length} links
        </span>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {isLoading && (
          <div className="flex justify-center py-6">
            <OrbitaSpinner className="size-5 text-muted-foreground" />
          </div>
        )}
        {!isLoading && links.length === 0 && (
          <p className="rounded-[20px] border border-dashed border-line p-4 text-center text-sm text-muted-foreground">
            Nenhum link criado ainda.
          </p>
        )}
        {links.map((link) => {
          const status = getStatus(link);
          return (
            <div
              key={link.id}
              className="flex items-center gap-3 rounded-[20px] border border-line bg-card p-3"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-knob">
                <Link2 className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-medium capitalize">{link.role}</span>
                  <InviteLinkStatusBadge status={status} />
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Expira em {formatDate(link.expiresAt)} · {link.usesCount} usos
                </p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Star className="size-3 text-warning" />
                  {link.starsOnJoin} Stars ao entrar
                </p>
              </div>
              <InviteLinkOptionsMenu
                status={status}
                canManage={canManage}
                onCopy={() => copyLink(link.token)}
                onRevoke={() => revokeLinkMutation.mutate(link.id)}
                onDelete={() => deleteLinkMutation.mutate(link.id)}
              />
            </div>
          );
        })}
      </div>

      <div className="max-md:hidden">
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
                <TableCell colSpan={7}>
                  <div className="flex justify-center py-2">
                    <OrbitaSpinner className="size-5 text-muted-foreground" />
                  </div>
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
                      <Star className="size-3.5 text-warning" />
                      {link.starsOnJoin}
                    </span>
                  </TableCell>
                  <TableCell>
                    <InviteLinkStatusBadge status={status} />
                  </TableCell>
                  <TableCell>
                    <InviteLinkOptionsMenu
                      status={status}
                      canManage={canManage}
                      onCopy={() => copyLink(link.token)}
                      onRevoke={() => revokeLinkMutation.mutate(link.id)}
                      onDelete={() => deleteLinkMutation.mutate(link.id)}
                    />
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
        onCreated={() => queryClient.invalidateQueries()}
      />
    </div>
  );
}

function InviteLinkStatusBadge({ status }: { status: InviteLinkStatus }) {
  if (status === "active") {
    return (
      <Badge className="rounded-full border-success/30 bg-success/15 text-success">Ativo</Badge>
    );
  }
  if (status === "expired") {
    return (
      <Badge variant="outline" className="rounded-full">
        Expirado
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="rounded-full">
      Revogado
    </Badge>
  );
}

interface InviteLinkOptionsMenuProps {
  status: InviteLinkStatus;
  canManage: boolean;
  onCopy: () => void;
  onRevoke: () => void;
  onDelete: () => void;
}

function InviteLinkOptionsMenu({
  status,
  canManage,
  onCopy,
  onRevoke,
  onDelete,
}: InviteLinkOptionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Opções do link" className="size-9 rounded-full">
          <EllipsisVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Opções</DropdownMenuLabel>
        <DropdownMenuItem className="cursor-pointer" onClick={onCopy}>
          <Copy className="size-4" />
          Copiar link
        </DropdownMenuItem>
        {canManage && status === "active" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" variant="destructive" onClick={onRevoke}>
              Revogar link
            </DropdownMenuItem>
          </>
        )}
        {canManage && status === "revoked" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" variant="destructive" onClick={onDelete}>
              <Trash2 className="size-4" />
              Excluir link
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
