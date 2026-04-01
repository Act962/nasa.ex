import { requireAdminSession } from "@/lib/admin-utils";
import prisma from "@/lib/prisma";
import { CreditCard, Users, Star } from "lucide-react";

export default async function PlansPage() {
  await requireAdminSession();

  const plans = await prisma.plan.findMany({
    orderBy: { priceMonthly: "asc" },
    select: {
      id: true, slug: true, name: true, monthlyStars: true,
      priceMonthly: true, maxUsers: true, rolloverPct: true, isActive: true,
      _count: { select: { organizations: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-violet-400" /> Planos
        </h1>
        <p className="text-sm text-zinc-400 mt-1">{plans.length} plano(s) cadastrado(s)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {plans.map((p) => (
          <div key={p.id} className={`bg-zinc-900 border rounded-xl p-5 ${p.isActive ? "border-zinc-800" : "border-zinc-800/50 opacity-60"}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-lg font-bold text-white">{p.name}</p>
                <p className="text-xs text-zinc-500 font-mono">{p.slug}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${p.isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700 text-zinc-500"}`}>
                {p.isActive ? "Ativo" : "Inativo"}
              </span>
            </div>

            <div className="text-3xl font-bold text-white mb-1">
              R$ {Number(p.priceMonthly).toFixed(2)}
              <span className="text-sm text-zinc-500 font-normal">/mês</span>
            </div>

            <div className="space-y-2 mt-4 text-sm text-zinc-400">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-yellow-400" /> Stars/mês</span>
                <span className="font-semibold text-white">{p.monthlyStars.toLocaleString("pt-BR")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-blue-400" /> Máx. usuários</span>
                <span className="font-semibold text-white">{p.maxUsers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Rollover máx.</span>
                <span className="font-semibold text-white">{p.rolloverPct}%</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 text-center">
                <span className="text-white font-semibold">{p._count.organizations}</span> empresa(s) neste plano
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
