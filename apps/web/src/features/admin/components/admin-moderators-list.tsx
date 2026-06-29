"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff, Search } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

type Admin = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: Date;
  members: Array<{ organization: { name: string } }>;
};

export function AdminModeratorsList({ admins }: { admins: Admin[] }) {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const mutation = useMutation({
    ...orpc.admin.setSystemAdmin.mutationOptions(),
    onSuccess: (_, vars) => {
      toast.success(vars.isSystemAdmin ? "Acesso concedido" : "Acesso revogado");
      qc.invalidateQueries();
    },
    onError: () => toast.error("Não foi possível alterar permissão"),
  });

  const filtered = admins.filter(
    (a) => a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar moderador..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500/60"
        />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
        {filtered.map((admin) => (
          <div key={admin.id} className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              {admin.image
                ? <img src={admin.image} className="w-9 h-9 rounded-full" />
                : <div className="w-9 h-9 rounded-full bg-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-300">{admin.name[0]?.toUpperCase()}</div>
              }
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{admin.name}</p>
                  <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <p className="text-xs text-zinc-500">{admin.email}</p>
                {admin.members[0] && (
                  <p className="text-[11px] text-zinc-600 mt-0.5">{admin.members[0].organization.name}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => mutation.mutate({ userId: admin.id, isSystemAdmin: false })}
              disabled={mutation.isPending}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 px-3 py-1.5 rounded-lg transition-colors"
            >
              <ShieldOff className="w-3.5 h-3.5" /> Revogar acesso
            </button>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-zinc-500">Nenhum moderador encontrado.</div>
        )}
      </div>

      <p className="text-xs text-zinc-600">
        Para conceder acesso a um novo moderador, acesse a empresa dele em <strong className="text-zinc-500">/admin/companies</strong> e clique no ícone de escudo na coluna "Admin Sistema".
      </p>
    </div>
  );
}
