import { requireAdminSession } from "@/lib/admin-utils";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Building2, Star, Users, ChevronRight } from "lucide-react";

interface SearchParams { search?: string; planId?: string; page?: string }

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminSession();
  const params = await searchParams;
  const search = params.search ?? "";
  const planId = params.planId ?? "";
  const page = Number(params.page ?? 1);
  const limit = 25;

  const where = {
    ...(search ? { OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { slug: { contains: search, mode: "insensitive" as const } },
    ]} : {}),
    ...(planId ? { planId } : {}),
  };

  const [orgs, total, plans] = await Promise.all([
    prisma.organization.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, slug: true, logo: true, starsBalance: true, createdAt: true,
        plan: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
    }),
    prisma.organization.count({ where }),
    prisma.plan.findMany({ select: { id: true, name: true }, orderBy: { priceMonthly: "asc" } }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Empresas</h1>
          <p className="text-sm text-zinc-400 mt-1">{total.toLocaleString("pt-BR")} organização(ões)</p>
        </div>
      </div>

      {/* Filters */}
      <form className="flex gap-3 flex-wrap">
        <input
          name="search"
          defaultValue={search}
          placeholder="Buscar por nome ou slug..."
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500/60 w-72"
        />
        <select
          name="planId"
          defaultValue={planId}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/60"
        >
          <option value="">Todos os planos</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button
          type="submit"
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Filtrar
        </button>
      </form>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3">Empresa</th>
                <th className="text-left px-5 py-3">Plano</th>
                <th className="text-right px-5 py-3"><Star className="w-3 h-3 inline mr-1" />Stars</th>
                <th className="text-right px-5 py-3"><Users className="w-3 h-3 inline mr-1" />Membros</th>
                <th className="text-right px-5 py-3">Criação</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {orgs.map((org) => (
                <tr key={org.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center shrink-0">
                        {org.logo
                          ? <img src={org.logo} alt={org.name} className="w-8 h-8 rounded-lg object-cover" />
                          : <Building2 className="w-4 h-4 text-zinc-400" />
                        }
                      </div>
                      <div>
                        <p className="font-medium text-white">{org.name}</p>
                        <p className="text-[11px] text-zinc-500">{org.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${org.plan ? "bg-violet-500/20 text-violet-300" : "bg-zinc-700 text-zinc-400"}`}>
                      {org.plan?.name ?? "Sem plano"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-yellow-400">
                    {org.starsBalance.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-5 py-4 text-right text-zinc-300">
                    {org._count.members}
                  </td>
                  <td className="px-5 py-4 text-right text-zinc-500 text-xs">
                    {new Date(org.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/companies/${org.id}`}
                      className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      Detalhes <ChevronRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
            <span>Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`?search=${search}&planId=${planId}&page=${page - 1}`}
                  className="px-3 py-1.5 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors">
                  ← Anterior
                </Link>
              )}
              {page < totalPages && (
                <Link href={`?search=${search}&planId=${planId}&page=${page + 1}`}
                  className="px-3 py-1.5 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors">
                  Próxima →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
