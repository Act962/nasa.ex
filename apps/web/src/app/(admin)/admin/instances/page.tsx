import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Search, Wifi, WifiOff } from "lucide-react";

interface SearchParams { search?: string; status?: string; page?: string }

export default async function InstancesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminSession();
  const params = await searchParams;
  const search = params.search ?? "";
  const status = params.status ?? "";
  const page = Number(params.page ?? 1);
  const limit = 25;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { instanceName: { contains: search, mode: "insensitive" } },
      { phoneNumber:  { contains: search, mode: "insensitive" } },
      { organization: { name: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (status) where.status = status;

  const [instances, total, connected, disconnected] = await Promise.all([
    prisma.whatsAppInstance.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, instanceName: true, status: true,
        phoneNumber: true, profileName: true,
        isActive: true, isBusiness: true,
        organizationId: true, createdAt: true, lastSyncAt: true,
        organization: { select: { name: true } },
      },
    }),
    prisma.whatsAppInstance.count({ where }),
    prisma.whatsAppInstance.count({ where: { status: "CONNECTED" } }),
    prisma.whatsAppInstance.count({ where: { status: "DISCONNECTED" } }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Instâncias Conectadas</h1>
        <p className="text-sm text-zinc-400 mt-1">WhatsApp Business por empresa</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
          <Wifi className="w-5 h-5 text-emerald-400" />
          <div>
            <p className="text-2xl font-bold text-white">{connected}</p>
            <p className="text-xs text-zinc-500">Conectadas</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-red-400" />
          <div>
            <p className="text-2xl font-bold text-white">{disconnected}</p>
            <p className="text-xs text-zinc-500">Desconectadas</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
          <Wifi className="w-5 h-5 text-zinc-400" />
          <div>
            <p className="text-2xl font-bold text-white">{total}</p>
            <p className="text-xs text-zinc-500">Total</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            name="search"
            defaultValue={search}
            placeholder="Buscar instância ou empresa..."
            className="pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 w-64"
          />
        </div>
        <select
          name="status"
          defaultValue={status}
          className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500"
        >
          <option value="">Todos os status</option>
          <option value="CONNECTED">Conectado</option>
          <option value="DISCONNECTED">Desconectado</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors">
          Filtrar
        </button>
        {(search || status) && (
          <Link href="/admin/instances" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors">
            Limpar
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Instância</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Empresa</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Número</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Última sync</th>
            </tr>
          </thead>
          <tbody>
            {instances.map((inst) => (
              <tr key={inst.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-white">{inst.instanceName}</p>
                  {inst.profileName && (
                    <p className="text-xs text-zinc-500">{inst.profileName}</p>
                  )}
                  {inst.isBusiness && (
                    <span className="text-[10px] text-blue-400 font-medium">Business</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/companies/${inst.organizationId}`}
                    className="text-sm text-zinc-300 hover:text-violet-300 transition-colors"
                  >
                    {inst.organization.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                    inst.status === "CONNECTED"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400"
                  }`}>
                    {inst.status === "CONNECTED" ? (
                      <Wifi className="w-3 h-3" />
                    ) : (
                      <WifiOff className="w-3 h-3" />
                    )}
                    {inst.status === "CONNECTED" ? "Conectado" : "Desconectado"}
                  </span>
                  {!inst.isActive && (
                    <span className="ml-2 text-[10px] text-zinc-600">inativo</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-400">
                  {inst.phoneNumber ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {inst.lastSyncAt
                    ? new Date(inst.lastSyncAt).toLocaleString("pt-BR")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {instances.length === 0 && (
          <p className="text-center py-8 text-sm text-zinc-500">Nenhuma instância encontrada.</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">Página {page} de {totalPages}</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/admin/instances?search=${search}&status=${status}&page=${page - 1}`}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors">
                ← Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/admin/instances?search=${search}&status=${status}&page=${page + 1}`}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors">
                Próximo →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
