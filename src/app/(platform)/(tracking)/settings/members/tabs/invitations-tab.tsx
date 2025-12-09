"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { authClient } from "@/lib/auth-client";
import { EllipsisVertical, Plus } from "lucide-react";
import { toast } from "sonner";

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

  const getInviter = (inviterId: string) => {
    const inviter = members.find((member) => member.userId === inviterId);
    return inviter;
  };

  const cancelInvitation = async (invitationId: string) => {
    await authClient.organization
      .cancelInvitation({
        invitationId,
      })
      .then((res) => {
        if (res.error) {
          toast.error("Erro ao cancelar convite");
          return;
        }

        toast.success("Convite cancelado com sucesso");
      });
  };

  return (
    <div className="space-y-6">
      <div className="w-full flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Convites</h2>
          <p className="text-sm text-foreground/50">
            Gerencie os convites para a sua organização.
          </p>
        </div>

        <Button onClick={() => onOpen()}>
          <Plus className="size-4" /> Adicionar Membro
        </Button>
      </div>

      <div>
        <span className="text-muted-foreground text-xs">
          {invitations.length} convites
        </span>
      </div>

      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Convite Por</TableHead>
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
                          " "
                        )[0][0] || ""}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-foreground">
                      {getInviter(invitation.inviterId)?.user.name || ""}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size={"icon-xs"} variant={"ghost"}>
                        <EllipsisVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Opções</DropdownMenuLabel>
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          variant="destructive"
                          onClick={() => cancelInvitation(invitation.id)}
                        >
                          Revogar Convite
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
