"use client";

import { useMemo } from "react";
import { Crown, Users2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getPosition, type PositionOption } from "@/features/company/constants";
import type { OrgMemberRow } from "./member-types";

type HierarchyMember = Pick<OrgMemberRow, "id" | "cargo" | "user">;

function MemberChip({ member, isUnassigned }: { member: HierarchyMember; isUnassigned?: boolean }) {
  return (
    <div
      className={
        isUnassigned
          ? "flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-2 py-1"
          : "flex items-center gap-2 rounded-full border border-border/60 bg-background px-2 py-1"
      }
    >
      <Avatar className="size-6">
        <AvatarImage src={member.user.image || ""} />
        <AvatarFallback className="text-[10px]">{member.user.name?.[0] ?? "?"}</AvatarFallback>
      </Avatar>
      <span className="text-xs font-medium">{member.user.name}</span>
    </div>
  );
}

/** Equipe agrupada por nível hierárquico do cargo (N1 no topo). */
export function TeamHierarchy({ members }: { members: HierarchyMember[] }) {
  const grouped = useMemo(() => {
    const levelBuckets = new Map<
      number,
      { position: PositionOption; members: HierarchyMember[] }
    >();
    const unassigned: HierarchyMember[] = [];

    for (const member of members) {
      const position = getPosition(member.cargo);
      if (!position) {
        unassigned.push(member);
        continue;
      }
      const existingBucket = levelBuckets.get(position.level);
      if (existingBucket) {
        existingBucket.members.push(member);
      } else {
        levelBuckets.set(position.level, { position, members: [member] });
      }
    }

    return {
      levels: Array.from(levelBuckets.entries())
        .sort((first, second) => first[0] - second[0])
        .map(([, bucket]) => bucket),
      unassigned,
    };
  }, [members]);

  if (grouped.levels.length === 0 && grouped.unassigned.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-2">
        <Users2 className="size-4 text-info" />
        <h3 className="text-lg font-semibold">Hierarquia da equipe</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Do topo (N1) à base (N10), conforme o cargo de cada pessoa.
      </p>

      <div className="space-y-3">
        {grouped.levels.map(({ position, members: levelMembers }) => (
          <div key={position.level} className="rounded-[20px] border border-line bg-card/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              {position.level === 1 && <Crown className="size-3.5 text-warning" />}
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Nível {position.level} · {position.label}
              </span>
              <Badge variant="secondary" className="h-4 rounded-full px-1.5 text-[10px]">
                {levelMembers.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {levelMembers.map((member) => (
                <MemberChip key={member.id} member={member} />
              ))}
            </div>
          </div>
        ))}

        {grouped.unassigned.length > 0 && (
          <div className="rounded-[20px] border border-dashed border-line p-4">
            <div className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Sem cargo definido · {grouped.unassigned.length}
            </div>
            <div className="flex flex-wrap gap-2">
              {grouped.unassigned.map((member) => (
                <MemberChip key={member.id} member={member} isUnassigned />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
