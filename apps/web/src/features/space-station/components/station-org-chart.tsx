"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Crown, Users } from "lucide-react";
import { useOrgChart } from "../hooks/use-station";

interface Props {
  nick: string;
}

function MemberCard({
  member,
}: {
  member: {
    id: string;
    role: string;
    cargo: string | null;
    user: {
      id: string;
      name: string;
      image: string | null;
      nickname: string | null;
      spaceStation: { nick: string; isPublic: boolean } | null;
    };
  };
}) {
  const stationNick = member.user.spaceStation?.nick;
  const isPublic = member.user.spaceStation?.isPublic;

  const card = (
    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer min-w-[100px]">
      <div className="relative h-12 w-12 rounded-full overflow-hidden bg-indigo-800">
        {member.user.image ? (
          <Image src={member.user.image} alt={member.user.name} fill className="object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-lg font-bold text-white">
            {member.user.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="text-white text-xs font-medium leading-tight">{member.user.name}</p>
        {member.cargo && (
          <p className="text-slate-400 text-xs leading-tight">{member.cargo}</p>
        )}
        {member.user.nickname && (
          <p className="text-indigo-400 text-xs font-mono">@{member.user.nickname}</p>
        )}
      </div>
    </div>
  );

  if (stationNick && isPublic) {
    return <Link href={`/@${stationNick}`}>{card}</Link>;
  }
  return card;
}

export function StationOrgChart({ nick }: Props) {
  const { data, isLoading } = useOrgChart(nick);

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-32" />
        <div className="flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 w-24 bg-white/10 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {data.commanders.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Crown className="h-4 w-4 text-yellow-400" />
            <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider">
              Comandantes
            </h3>
            <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-500">
              {data.commanders.length}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-3">
            {data.commanders.map((m) => (
              <MemberCard key={m.id} member={m} />
            ))}
          </div>
        </div>
      )}

      {data.crew.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">
              Tripulação
            </h3>
            <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-500">
              {data.crew.length}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-3">
            {data.crew.map((m) => (
              <MemberCard key={m.id} member={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
