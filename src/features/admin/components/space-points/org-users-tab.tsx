"use client";

import { useState } from "react";
import Image from "next/image";
import { Search, Zap } from "lucide-react";
import { useAdminOrgUsers } from "./hooks";
import { AdjustModal } from "./adjust-modal";

export function OrgUsersTab({ orgId }: { orgId: string }) {
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState("");
  const [adjusting, setAdjusting] = useState<{ userId: string; name: string; total: number } | null>(null);
  const { data, isLoading } = useAdminOrgUsers(orgId, page);

  const filtered = (data?.users ?? []).filter((u) =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {adjusting && (
        <AdjustModal userId={adjusting.userId} orgId={orgId} userName={adjusting.name} totalPoints={adjusting.total} onClose={() => setAdjusting(null)} />
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar usuário..."
          className="w-full pl-8 pr-3 py-2 text-sm bg-muted border border-line rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum usuário encontrado.</p>
      ) : (
        <div className="space-y-1">
          {filtered.map((u, idx) => (
            <div key={u.userId} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-all">
              <span className="text-xs text-muted-foreground w-5 shrink-0">{(page - 1) * 20 + idx + 1}</span>
              <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 border border-line">
                {u.image
                  ? <Image src={u.image} alt={u.name} fill className="object-cover" />
                  : <div className="w-full h-full bg-info/15 flex items-center justify-center text-xs text-info font-bold">{u.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{u.email} {u.levelName ? `· ${u.levelName}` : ""}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-info">{u.totalPoints.toLocaleString("pt-BR")} pts</p>
                <p className="text-[10px] text-muted-foreground">{u.weeklyPoints} esta semana</p>
              </div>
              <button onClick={() => setAdjusting({ userId: u.userId, name: u.name, total: u.totalPoints })} title="Ajustar pontos"
                className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg bg-knob hover:bg-info/15 transition-all text-muted-foreground hover:text-info">
                <Zap className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {data && data.total > 20 && (
        <div className="flex items-center justify-between pt-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
            className="text-xs px-3 py-1.5 rounded-lg bg-muted text-foreground hover:bg-knob disabled:opacity-40">← Anterior</button>
          <span className="text-xs text-muted-foreground">Página {page} · {data.total} total</span>
          <button disabled={page * 20 >= data.total} onClick={() => setPage((p) => p + 1)}
            className="text-xs px-3 py-1.5 rounded-lg bg-muted text-foreground hover:bg-knob disabled:opacity-40">Próximo →</button>
        </div>
      )}
    </div>
  );
}
