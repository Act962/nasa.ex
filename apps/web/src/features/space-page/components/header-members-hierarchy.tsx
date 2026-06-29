"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { UserProfileDropdown } from "./user-profile-dropdown";

interface CrewMemberData {
  memberId:    string;
  userId:      string;
  displayName: string;
  image:       string | null;
  jobTitle:    string;
  level:       number;
  group:       string;
  role:        string;
}

interface PyramidRow {
  tier:    string;
  members: CrewMemberData[];
}

/**
 * Agrupa por tier hierárquico (6 níveis) → cada tier vira uma linha da
 * pirâmide. N1 no topo (fundadores), descendo até Entrada/Suporte na base.
 *
 * Aliases legados: `lideranca` é remapeado pra `n1` (caso ainda apareça
 * em payloads antigos de cache).
 */
function buildPyramid(crew: CrewMemberData[]): PyramidRow[] {
  const tiers: Record<string, CrewMemberData[]> = {
    n1:          [],
    n2:          [],
    n3:          [],
    gestao:      [],
    operacional: [],
    entrada:     [],
  };
  for (const m of crew) {
    const key = m.group === "lideranca" ? "n1" : m.group;
    if (tiers[key]) tiers[key].push(m);
  }
  const order = ["n1", "n2", "n3", "gestao", "operacional", "entrada"];
  return order
    .map((tier) => ({ tier, members: tiers[tier] }))
    .filter((r) => r.members.length > 0);
}

/**
 * Tripulação no canto superior direito do banner — pirâmide hierárquica
 * agrupando membros por tier (Liderança / Gestão / Operação / Entrada).
 *
 * Usa `getCrew` (membros reais da org com cargo) em vez de `getOrgChart`
 * (organograma com publicConsent), para que apareçam mesmo sem
 * organograma configurado.
 */
export function HeaderMembersHierarchy({ nick }: { nick: string }) {
  const { data, isLoading } = useQuery(
    orpc.public.space.getCrew.queryOptions({ input: { nick } }),
  );

  const rows = useMemo(() => buildPyramid(data?.crew ?? []), [data]);
  const [openProfile, setOpenProfile] = useState<string | null>(null);

  if (isLoading || rows.length === 0) return null;

  return (
    <>
      <div
        className="hidden md:flex absolute right-6 top-6 max-w-[60%] flex-col items-end gap-5 pointer-events-auto"
        aria-label="Tripulação da empresa"
      >
        {rows.map((row) => (
          <div key={row.tier} className="flex flex-wrap justify-end gap-x-5 gap-y-3">
            {row.members.slice(0, 16).map((m) => (
              <CrewMember
                key={m.memberId}
                member={m}
                onClick={() => setOpenProfile(m.userId)}
              />
            ))}
            {row.members.length > 16 && (
              <div className="flex h-12 w-12 items-center justify-center self-start rounded-full border border-white/20 bg-white/5 text-xs font-bold text-white/70">
                +{row.members.length - 16}
              </div>
            )}
          </div>
        ))}
      </div>

      {openProfile && (
        <UserProfileDropdown
          userId={openProfile}
          onClose={() => setOpenProfile(null)}
        />
      )}
    </>
  );
}

function CrewMember({ member, onClick }: { member: CrewMemberData; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${member.displayName} — ${member.jobTitle}`}
      className="group flex flex-col items-center gap-1 transition-transform hover:scale-105 focus:outline-none"
    >
      <div className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-white/90 bg-slate-800 shadow-lg ring-0 transition group-hover:border-orange-300 group-hover:ring-2 group-hover:ring-orange-300/40">
        {member.image ? (
          <Image
            src={member.image}
            alt={member.displayName}
            fill
            className="object-cover"
            sizes="48px"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white/80">
            {member.displayName[0]?.toUpperCase()}
          </div>
        )}
      </div>
      <span className="text-[12px] font-bold leading-tight text-white drop-shadow">
        {member.displayName.split(" ")[0]}
      </span>
      <span className="-mt-0.5 max-w-[90px] truncate text-[10px] leading-tight text-white/70 drop-shadow">
        {member.jobTitle}
      </span>
    </button>
  );
}
