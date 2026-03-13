"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMemberModal } from "@/hooks/use-member";
import { Plus } from "lucide-react";
import Image from "next/image";

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

interface MemberTabsProps {
  members: Members[];
}

export function MembersTab({ members }: MemberTabsProps) {
  const { onOpen } = useMemberModal();

  return (
    <div className="space-y-6">
      <div className="w-full flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Membros</h2>
          <p className="text-sm text-foreground/50">
            Gerencie os membros da sua organização.
          </p>
        </div>

        <Button onClick={() => onOpen()}>
          <Plus className="size-4" /> Adicionar Membro
        </Button>
      </div>

      <div>
        <span className="text-muted-foreground text-xs">
          {members.length} membros
        </span>
      </div>

      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left"></TableHead>
              <TableHead className="text-left">Nome</TableHead>
              <TableHead className="text-left">Email</TableHead>
              <TableHead className="text-left">Cargo</TableHead>
              <TableHead className="text-left">Data de Entrada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="text-left">
                  <div className="flex items-center gap-2">
                    <Avatar>
                      <AvatarImage
                        src={member.user.image || ""}
                        alt={member.user.name}
                        className="size-8 rounded-full"
                      />
                      <AvatarFallback>
                        {member.user.name.split(" ")[0][0]}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </TableCell>
                <TableCell className="text-left">{member.user.name}</TableCell>
                <TableCell className="text-left">{member.user.email}</TableCell>
                <TableCell className="text-left">{member.role}</TableCell>
                <TableCell className="text-left">
                  {new Date(member.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
