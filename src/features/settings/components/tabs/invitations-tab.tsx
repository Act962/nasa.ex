"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
import { useMemberModal } from "@/hooks/use-member";
import { useOrgRole } from "@/hooks/use-org-role";
import { authClient } from "@/lib/auth-client";
import { Copy, EllipsisVertical, Mail, Plus } from "lucide-react";
import { toast } from "sonner";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";

interface Members {
  id: string;
  organizationId: string;
  role: "member" | "admin" | "owner";
  createdAt: Date;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | undefined;
  };
}

interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  role: "member" | "admin" | "owner";
  status: "pending" | "accepted" | "rejected" | "canceled";
  inviterId: string;
  expiresAt: Date;
  createdAt: Date;
}

export function InvitationsTab({
  invitations,
  members,
}: {
  invitations: Invitation[];
  members: Members[];
}) {
  const { onOpen } = useMemberModal();
  const { canManage } = useOrgRole();

  const getInviter = (inviterId: string) => {
    const inviter = members.find((member) => member.userId === inviterId);
    return inviter;
  };

  const copyInvitationLink = async (invitationId: string) => {
    const link = `${process.env.NEXT_PUBLIC_BASE_URL}/accept-invitation?inviteId=${invitationId}`;
    await navigator.clipboard.writeText(link);
    toast.success("Link de convite copiado");
  };

  const cancelInvitation = async (invitationId: string) => {
    await authClient.organization
      .cancelInvitation({
        invitationId,
      })
      .then((response) => {
        if (response.error) {
          toast.error("Erro ao cancelar convite");
          return;
        }

        toast.success("Convite cancelado com sucesso");
      });
  };

  return (
    <div className="space-y-6">
      <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="max-md:hidden">
          <h2 className="text-2xl font-bold text-foreground">Convites</h2>
          <p className="text-sm text-muted-foreground">
            Convites enviados que ainda não foram aceitos.
          </p>
        </div>

        {canManage && (
          <Button
            onClick={() => onOpen()}
            data-guide={GUIDE_ANCHORS.memberAddButton.id}
            className="h-11 w-full rounded-full md:h-9 md:w-auto"
          >
            <Plus className="size-4" /> Adicionar membro
          </Button>
        )}
      </div>

      <div>
        <span className="text-muted-foreground text-xs">
          {invitations.length} convites
        </span>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {invitations.map((invitation) => {
          const inviter = getInviter(invitation.inviterId);
          return (
            <div
              key={invitation.id}
              className="flex items-center gap-3 rounded-[20px] border border-line bg-card p-3"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-knob">
                <Mail className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{invitation.email}</p>
                <p className="truncate text-xs text-muted-foreground capitalize">
                  {invitation.role}
                  {inviter ? ` · convidado por ${inviter.user.name}` : ""}
                </p>
              </div>
              <InvitationOptionsMenu
                onCopyLink={() => copyInvitationLink(invitation.id)}
                onCancel={() => cancelInvitation(invitation.id)}
              />
            </div>
          );
        })}
        {invitations.length === 0 && (
          <p className="rounded-[20px] border border-dashed border-line p-4 text-center text-sm text-muted-foreground">
            Nenhum convite pendente.
          </p>
        )}
      </div>

      <div className="max-md:hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Convidado por</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invitation) => (
              <TableRow key={invitation.id}>
                <TableCell>{invitation.email}</TableCell>
                <TableCell>{invitation.role}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar>
                      <AvatarImage
                        src={getInviter(invitation.inviterId)?.user.image || ""}
                        alt={getInviter(invitation.inviterId)?.user.name || ""}
                        className="size-8 rounded-full"
                      />
                      <AvatarFallback>
                        {getInviter(invitation.inviterId)?.user.name.split(
                          " ",
                        )[0][0] || ""}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-foreground">
                      {getInviter(invitation.inviterId)?.user.name || ""}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <InvitationOptionsMenu
                    onCopyLink={() => copyInvitationLink(invitation.id)}
                    onCancel={() => cancelInvitation(invitation.id)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function InvitationOptionsMenu({
  onCopyLink,
  onCancel,
}: {
  onCopyLink: () => void;
  onCancel: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Opções do convite" className="size-9 rounded-full">
          <EllipsisVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Opções</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem className="cursor-pointer" onClick={onCopyLink}>
            <Copy className="size-4" />
            Copiar link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer" variant="destructive" onClick={onCancel}>
            Cancelar convite
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
