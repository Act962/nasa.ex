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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useMemberModal } from "@/hooks/use-member";
import { useOrgRole } from "@/hooks/use-org-role";
import { Plus, Crown, Users2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc, client as orpcClient } from "@/lib/orpc";
import { authClient } from "@/lib/auth-client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  POSITIONS,
  POSITION_GROUP_LABELS,
  getPosition,
  getPositionLabel,
  type PositionOption,
} from "@/features/company/constants";

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

  const members = useMemo(() => {
    if (detailed?.members) {
      return detailed.members.map((m) => ({
        id: m.id,
        role: m.role,
        cargo: m.cargo ?? null,
        createdAt: m.createdAt,
        userId: m.userId,
        user: {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image ?? null,
        },
      }));
    }
    return ssrMembers.map((m) => ({
      id: m.id,
      role: m.role,
      cargo: null as string | null,
      createdAt: m.createdAt,
      userId: m.userId,
      user: {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image ?? null,
      },
    }));
  }, [detailed, ssrMembers]);

  return (
    <div className="space-y-8">
      <div className="w-full flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Membros</h2>
          <p className="text-sm text-foreground/50">
            Gerencie membros da sua organização e configure cargos hierárquicos.
          </p>
        </div>

        {canManage && (
          <Button onClick={() => onOpen()}>
            <Plus className="size-4" /> Adicionar Membro
          </Button>
        )}
      </div>

      <div className="text-muted-foreground text-xs flex items-center gap-3">
        <span>{members.length} membros</span>
        {isLoading && <span className="animate-pulse">carregando cargos…</span>}
      </div>

      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left"></TableHead>
              <TableHead className="text-left">Nome</TableHead>
              <TableHead className="text-left">Email</TableHead>
              <TableHead className="text-left">Permissão</TableHead>
              <TableHead className="text-left">Cargo</TableHead>
              <TableHead className="text-left">Entrou em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="text-left">
                  <Avatar>
                    <AvatarImage
                      src={member.user.image || ""}
                      alt={member.user.name}
                      className="size-8 rounded-full"
                    />
                    <AvatarFallback>
                      {member.user.name?.split(" ")[0]?.[0] ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="text-left">{member.user.name}</TableCell>
                <TableCell className="text-left text-muted-foreground">
                  {member.user.email}
                </TableCell>
                <TableCell className="text-left">
                  <Badge variant="outline" className="capitalize">
                    {member.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-left">
                  <CargoCell
                    memberId={member.id}
                    memberUserId={member.userId}
                    cargo={member.cargo}
                    canManage={canManage}
                    isSelf={member.userId === currentUserId}
                    onUpdated={() => {
                      queryClient.invalidateQueries({
                        queryKey: orpc.orgs.listMembersDetailed.key(),
                      });
                      queryClient.invalidateQueries({
                        queryKey: orpc.spaceHelp.getSetupProgress.key(),
                      });
                    }}
                  />
                </TableCell>
                <TableCell className="text-left text-muted-foreground text-xs">
                  {new Date(member.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ─── Hierarquia visual da equipe ──────────────────── */}
      <TeamHierarchy members={members} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// CargoCell — célula editável com Select de cargos hierárquicos
// ════════════════════════════════════════════════════════════════════════
function CargoCell({
  memberId,
  memberUserId,
  cargo,
  canManage,
  isSelf,
  onUpdated,
}: {
  memberId: string;
  memberUserId: string;
  cargo: string | null;
  canManage: boolean;
  isSelf: boolean;
  onUpdated: () => void;
}) {
  const canEdit = canManage || isSelf;
  const [isSaving, setIsSaving] = useState(false);
  const label = getPositionLabel(cargo);

  if (!canEdit) {
    return (
      <span className="text-sm text-muted-foreground">
        {label ?? <em className="opacity-60">não definido</em>}
      </span>
    );
  }

  const onChange = async (value: string) => {
    const next = value === "__clear__" ? null : value;
    setIsSaving(true);
    try {
      await orpcClient.orgs.updateMemberCargo({
        memberId,
        cargo: next,
      });
      onUpdated();
      toast.success("Cargo atualizado");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao atualizar cargo");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Select value={cargo ?? ""} onValueChange={onChange} disabled={isSaving}>
      <SelectTrigger className="h-8 w-[200px] text-xs">
        <SelectValue placeholder="Definir cargo…" />
      </SelectTrigger>
      <SelectContent>
        {(["n1", "n2", "n3", "gestao", "operacional", "entrada"] as const).map((group) => {
          const items = POSITIONS.filter((p) => p.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="py-1">
              <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {POSITION_GROUP_LABELS[group]}
              </div>
              {items.map((p) => (
                <SelectItem key={p.slug} value={p.slug} className="text-xs">
                  <span className="text-muted-foreground mr-1">N{p.level}</span>
                  {p.label}
                </SelectItem>
              ))}
            </div>
          );
        })}
        <div className="border-t my-1" />
        <SelectItem value="__clear__" className="text-xs text-muted-foreground">
          Limpar cargo
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TeamHierarchy — visualização agrupada por nível hierárquico
// ════════════════════════════════════════════════════════════════════════
interface HierarchyMember {
  id: string;
  role: string;
  cargo: string | null;
  userId: string;
  user: { id: string; name: string; email: string; image?: string | null };
}

function TeamHierarchy({ members }: { members: HierarchyMember[] }) {
  const grouped = useMemo(() => {
    const buckets = new Map<
      number,
      { position: PositionOption; members: HierarchyMember[] }
    >();
    const unassigned: HierarchyMember[] = [];

    for (const m of members) {
      const pos = getPosition(m.cargo);
      if (!pos) {
        unassigned.push(m);
        continue;
      }
      const existing = buckets.get(pos.level);
      if (existing) {
        existing.members.push(m);
      } else {
        buckets.set(pos.level, { position: pos, members: [m] });
      }
    }

    return {
      levels: Array.from(buckets.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, value]) => value),
      unassigned,
    };
  }, [members]);

  if (grouped.levels.length === 0 && grouped.unassigned.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 pt-6 border-t">
      <div className="flex items-center gap-2">
        <Users2 className="size-4 text-violet-500" />
        <h3 className="text-lg font-semibold">Hierarquia da equipe</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Ordenado do topo (N1) à base (N10) com base no cargo configurado.
      </p>

      <div className="space-y-3">
        {grouped.levels.map(({ position, members: lvlMembers }) => (
          <div
            key={position.level}
            className="rounded-xl border border-border/60 bg-card/50 p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              {position.level === 1 && (
                <Crown className="size-3.5 text-amber-500" />
              )}
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nível {position.level} · {position.label}
              </span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {lvlMembers.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {lvlMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-full bg-background border border-border/60 px-2 py-1"
                >
                  <Avatar className="size-6">
                    <AvatarImage src={m.user.image || ""} />
                    <AvatarFallback className="text-[10px]">
                      {m.user.name?.[0] ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium">{m.user.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {grouped.unassigned.length > 0 && (
          <div className="rounded-xl border border-dashed border-border/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Sem cargo definido · {grouped.unassigned.length}
            </div>
            <div className="flex flex-wrap gap-2">
              {grouped.unassigned.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-full bg-muted/40 border border-border/60 px-2 py-1"
                >
                  <Avatar className="size-6">
                    <AvatarImage src={m.user.image || ""} />
                    <AvatarFallback className="text-[10px]">
                      {m.user.name?.[0] ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs">{m.user.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
