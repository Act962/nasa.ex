"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";
import { Pencil, Check, X } from "lucide-react";

interface AppRow {
  slug: string;
  label: string;
  cost: {
    id: string;
    monthlyCost: number;
    setupCost: number;
    priceBrl: string | null;
  } | null;
}

export function AppCostManager({ apps }: { apps: AppRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<string, { monthly: string; setup: string; brl: string }>>({});

  const mut = useMutation({
    mutationFn: (data: { appSlug: string; monthlyCost: number; setupCost: number; priceBrl: string | null }) =>
      orpc.admin.updateAppCost.call(data),
    onSuccess: (_, vars) => {
      setEditing(null);
      router.refresh();
    },
  });

  function startEdit(app: AppRow) {
    setVals((v) => ({
      ...v,
      [app.slug]: {
        monthly: String(app.cost?.monthlyCost ?? 0),
        setup:   String(app.cost?.setupCost   ?? 0),
        brl:     app.cost?.priceBrl ?? "",
      },
    }));
    setEditing(app.slug);
  }

  function saveEdit(slug: string) {
    const v = vals[slug];
    if (!v) return;
    mut.mutate({
      appSlug:     slug,
      monthlyCost: parseInt(v.monthly) || 0,
      setupCost:   parseInt(v.setup)   || 0,
      priceBrl:    v.brl || null,
    });
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">App</th>
            <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Custo Mensal (⭐)</th>
            <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Setup (⭐)</th>
            <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Preço (R$)</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {apps.map((app) => {
            const isEditing = editing === app.slug;
            const v = vals[app.slug];
            return (
              <tr key={app.slug} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-white">{app.label}</p>
                  <p className="text-xs text-zinc-600 font-mono">{app.slug}</p>
                </td>

                {isEditing ? (
                  <>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number" min="0"
                        value={v?.monthly ?? ""}
                        onChange={(e) => setVals((s) => ({ ...s, [app.slug]: { ...s[app.slug], monthly: e.target.value } }))}
                        className="w-20 text-center px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-sm text-white focus:outline-none focus:border-violet-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number" min="0"
                        value={v?.setup ?? ""}
                        onChange={(e) => setVals((s) => ({ ...s, [app.slug]: { ...s[app.slug], setup: e.target.value } }))}
                        className="w-20 text-center px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-sm text-white focus:outline-none focus:border-violet-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="text"
                        value={v?.brl ?? ""}
                        onChange={(e) => setVals((s) => ({ ...s, [app.slug]: { ...s[app.slug], brl: e.target.value } }))}
                        placeholder="0.00"
                        className="w-24 text-center px-2 py-1 bg-zinc-800 border border-zinc-600 rounded text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => saveEdit(app.slug)}
                          disabled={mut.isPending}
                          className="p-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="p-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-center text-sm text-zinc-300">
                      {app.cost ? app.cost.monthlyCost.toLocaleString("pt-BR") : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-zinc-300">
                      {app.cost ? app.cost.setupCost.toLocaleString("pt-BR") : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-zinc-300">
                      {app.cost?.priceBrl ? `R$ ${app.cost.priceBrl}` : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => startEdit(app)}
                        className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-700 rounded transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
