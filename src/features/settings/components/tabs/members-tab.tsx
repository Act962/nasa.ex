"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useMemberModal } from "@/hooks/use-member";
import { useOrgRole } from "@/hooks/use-org-role";
import { orpc } from "@/lib/orpc";
import { authClient } from "@/lib/auth-client";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { MemberCargoSelect } from "./members/member-cargo-select";
import { TeamHierarchy } from "./members/team-hierarchy";
import {
  formatJoinedAt,
  toMemberInitial,
  type OrgMemberRow,
} from "./members/member-types";

const SEARCH_VISIBLE_FROM_COUNT = 6;

interface FallbackMember {
  id: string;
  organizationId: string;
  role: "member" | "admin" | "owner" | string;
  createdAt: Date | string;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
  };
}

interface MemberTabsProps {
  members: FallbackMember[];
}

export function MembersTab({ members: ssrMembers }: MemberTabsProps) {
  const { onOpen } = useMemberModal();
  const { canManage } = useOrgRole();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: detailed, isLoading } = useQuery({
    ...orpc.orgs.listMembersDetailed.queryOptions(),
    staleTime: 30_000,
  });

  const { data: session } = useQuery({
    queryKey: ["auth-session"],
    queryFn: () => authClient.getSession(),
    staleTime: 60_000,
  });
  const currentUserId = session?.data?.user?.id;

  const members = useMemo<OrgMemberRow[]>(() => {
    if (detailed?.members) {
      return detailed.members.map((member) => ({
        id: member.id,
        role: member.role,
        cargo: member.cargo ?? null,
        createdAt: member.createdAt,
        userId: member.userId,
        user: {
          id: member.user.id,
          name: member.user.name,
          email: member.user.email,
          image: member.user.image ?? null,
        },
      }));
    }
    return ssrMembers.map((member) => ({
      id: member.id,
      role: member.role,
      cargo: null,
      createdAt: member.createdAt,
      userId: member.userId,
      user: {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        image: member.user.image ?? null,
      },
    }));
  }, [detailed, ssrMembers]);

  const filteredMembers = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    if (!normalizedTerm) return members;
    return members.filter(
      (member) =>
        member.user.name?.toLowerCase().includes(normalizedTerm) ||
        member.user.email?.toLowerCase().includes(normalizedTerm),
    );
  }, [members, searchTerm]);

  const invalidateMemberQueries = () => {
    queryClient.invalidateQueries({ queryKey: orpc.orgs.listMembersDetailed.key() });
    queryClient.invalidateQueries({ queryKey: orpc.spaceHelp.getSetupProgress.key() });
  };

  return (
    <div className="space-y-6">
      <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="max-md:hidden">
          <h2 className="text-2xl font-bold text-foreground">Membros</h2>
          <p className="text-sm text-muted-foreground">
            Pessoas da sua empresa e o cargo de cada uma.
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

      {members.length >= SEARCH_VISIBLE_FROM_COUNT && (
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 rounded-full border-line bg-card pl-10"
            placeholder="Buscar por nome ou e-mail"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{filteredMembers.length} membros</span>
        {isLoading && (
          <span className="flex items-center gap-1.5">
            <OrbitaSpinner className="size-3.5" /> carregando cargos…
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {filteredMembers.map((member) => (
          <div key={member.id} className="space-y-3 rounded-[20px] border border-line bg-card p-3">
            <div className="flex items-center gap-3">
              <Avatar className="size-11">
                <AvatarImage src={member.user.image || ""} alt={member.user.name} />
                <AvatarFallback>{toMemberInitial(member.user.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{member.user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                <p className="text-xs text-muted-foreground">
                  Entrou em {formatJoinedAt(member.createdAt)}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 rounded-full capitalize">
                {member.role}
              </Badge>
            </div>
            <MemberCargoSelect
              memberId={member.id}
              cargo={member.cargo}
              canManage={canManage}
              isSelf={member.userId === currentUserId}
              onUpdated={invalidateMemberQueries}
              triggerClassName="w-full"
            />
          </div>
        ))}
        {filteredMembers.length === 0 && (
          <p className="rounded-[20px] border border-dashed border-line p-4 text-center text-sm text-muted-foreground">
            Nenhum membro encontrado.
          </p>
        )}
      </div>

      <div className="max-md:hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left"></TableHead>
              <TableHead className="text-left">Nome</TableHead>
              <TableHead className="text-left">E-mail</TableHead>
              <TableHead className="text-left">Permissão</TableHead>
              <TableHead className="text-left">Cargo</TableHead>
              <TableHead className="text-left">Entrou em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="text-left">
                  <Avatar>
                    <AvatarImage
                      src={member.user.image || ""}
                      alt={member.user.name}
                      className="size-8 rounded-full"
                    />
                    <AvatarFallback>{toMemberInitial(member.user.name)}</AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="text-left">{member.user.name}</TableCell>
                <TableCell className="text-left text-muted-foreground">
                  {member.user.email}
                </TableCell>
                <TableCell className="text-left">
                  <Badge variant="outline" className="rounded-full capitalize">
                    {member.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-left">
                  <MemberCargoSelect
                    memberId={member.id}
                    cargo={member.cargo}
                    canManage={canManage}
                    isSelf={member.userId === currentUserId}
                    onUpdated={invalidateMemberQueries}
                  />
                </TableCell>
                <TableCell className="text-left text-xs text-muted-foreground">
                  {formatJoinedAt(member.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TeamHierarchy members={members} />
    </div>
  );
}
