"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { MODULE_ICONS, MODULE_LABELS } from "../types";
import type { StationPublicModule, StationModule } from "../types";

interface Props {
  modules: StationPublicModule[];
  nick: string;
}

const MODULE_ROUTES: Partial<Record<StationModule, (nick: string, resourceId?: string | null) => string>> = {
  FORM: (nick, rid) => rid ? `/submit-form/${rid}` : `/@${nick}`,
  CHAT: (nick) => `/@${nick}#chat`,
  AGENDA: (nick) => `/agenda/${nick}/appointment`,
};

export function StationModulesGrid({ modules, nick }: Props) {
  const active = modules.filter((m) => m.isActive);
  if (active.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Serviços Disponíveis
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {active.map((m) => {
          const href = MODULE_ROUTES[m.module]?.(nick, m.resourceId) ?? `/@${nick}`;
          return (
            <Link key={m.id} href={href}>
              <Card className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-indigo-500/50 transition-all cursor-pointer group">
                <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                  <span className="text-3xl group-hover:scale-110 transition-transform">
                    {MODULE_ICONS[m.module]}
                  </span>
                  <span className="text-white text-xs font-medium">{MODULE_LABELS[m.module]}</span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
