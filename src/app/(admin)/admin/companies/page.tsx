import { requireAdminSession } from "@/features/admin/lib/admin-utils";
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
          <h1 className="text-xl font-bold text-foreground">Empresas</h1>
          <p className="text-sm text-muted-foreground mt-1">{total.toLocaleString("pt-BR")} organização(ões)</p>
        </div>
      </div>

      {/* Filters */}
      <form className="flex gap-3 flex-wrap">
        <input
          name="search"
          defaultValue={search}
          placeholder="Buscar por nome ou slug..."
          className="bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring w-72"
        />
        <select
          name="planId"
          defaultValue={planId}
          className="bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring"
        >
          <option value="">Todos os planos</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button
          type="submit"
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Filtrar
        </button>
      </form>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3">Empresa</th>
                <th className="text-left px-5 py-3">Plano</th>
                <th className="text-right px-5 py-3"><Star className="w-3 h-3 inline mr-1" />Stars</th>
                <th className="text-right px-5 py-3"><Users className="w-3 h-3 inline mr-1" />Membros</th>
                <th className="text-right px-5 py-3">Criação</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orgs.map((org) => (
                <tr key={org.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-knob flex items-center justify-center shrink-0">
                        {org.logo
                          ? <img src={org.logo} alt={org.name} className="w-8 h-8 rounded-lg object-cover" />
                          : <Building2 className="w-4 h-4 text-muted-foreground" />
                        }
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{org.name}</p>
                        <p className="text-[11px] text-muted-foreground">{org.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${org.plan ? "bg-info/20 text-info" : "bg-knob text-muted-foreground"}`}>
                      {org.plan?.name ?? "Sem plano"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-warning">
                    {org.starsBalance.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-5 py-4 text-right text-foreground">
                    {org._count.members}
                  </td>
                  <td className="px-5 py-4 text-right text-muted-foreground text-xs">
                    {new Date(org.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/companies/${org.id}`}
                      className="inline-flex items-center gap-1 text-xs text-info hover:text-info/80 transition-colors"
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
          <div className="px-5 py-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`?search=${search}&planId=${planId}&page=${page - 1}`}
                  className="px-3 py-1.5 bg-muted rounded-lg hover:bg-knob transition-colors">
                  ← Anterior
                </Link>
              )}
              {page < totalPages && (
                <Link href={`?search=${search}&planId=${planId}&page=${page + 1}`}
                  className="px-3 py-1.5 bg-muted rounded-lg hover:bg-knob transition-colors">
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
