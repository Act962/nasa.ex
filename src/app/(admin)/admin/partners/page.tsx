import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import prisma from "@/lib/prisma";
import Link from "next/link";
import {
  Handshake,
  ChevronRight,
  TrendingUp,
  Users,
} from "lucide-react";
import type { PartnerTier, PartnerStatus } from "@/generated/prisma/client";
import { PartnerPromoteButton } from "@/features/admin/components/partner-promote-dialog";

const TIER_LABEL: Record<PartnerTier, string> = {
  SUITE: "Suite",
  EARTH: "Earth",
  GALAXY: "Galaxy",
  CONSTELLATION: "Constellation",
  INFINITY: "Infinity",
};

const TIER_COLOR: Record<PartnerTier, string> = {
  SUITE: "bg-zinc-500/20 text-zinc-200",
  EARTH: "bg-blue-500/20 text-blue-300",
  GALAXY: "bg-purple-500/20 text-purple-300",
  CONSTELLATION: "bg-pink-500/20 text-pink-300",
  INFINITY: "bg-amber-500/20 text-amber-300",
};

const STATUS_LABEL: Record<PartnerStatus, string> = {
  ELIGIBLE: "Elegível",
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
};

const STATUS_COLOR: Record<PartnerStatus, string> = {
  ELIGIBLE: "bg-zinc-700 text-zinc-300",
  ACTIVE: "bg-emerald-500/20 text-emerald-300",
  SUSPENDED: "bg-rose-500/20 text-rose-300",
};

interface SearchParams {
  search?: string;
  tier?: string;
  status?: string;
  page?: string;
}

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminSession();
  const params = await searchParams;
  const search = params.search ?? "";
  const tier = (params.tier ?? "") as "" | PartnerTier;
  const status = (params.status ?? "") as "" | PartnerStatus;
  const page = Number(params.page ?? 1);
  const limit = 20;

  const where: Parameters<typeof prisma.partner.findMany>[0] = { where: {} };
  const w: Record<string, unknown> = {};
  if (tier) w.tier = tier;
  if (status) w.status = status;
  if (search) {
    w.user = {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    };
  }
  where.where = w;

  const [partners, total] = await Promise.all([
    prisma.partner.findMany({
      where: w,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { name: true, email: true, image: true },
        },
        _count: {
          select: {
            commissions: true,
            payouts: true,
          },
        },
      },
    }),
    prisma.partner.count({ where: w }),
  ]);

  // Contagem de orgs ativas por parceiro
  const partnerUserIds = partners.map((p) => p.userId);
  const activeReferralCounts =
    partnerUserIds.length > 0
      ? await prisma.partnerReferral.groupBy({
          by: ["partnerUserId"],
          where: {
            partnerUserId: { in: partnerUserIds },
            activityStatus: "ACTIVE",
          },
          _count: { _all: true },
        })
      : [];
  const activeByUser = new Map(
    activeReferralCounts.map((r) => [r.partnerUserId, r._count._all]),
  );

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Handshake className="w-5 h-5 text-amber-400" /> Parceiros NASA
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {total.toLocaleString("pt-BR")} parceiro(s) cadastrado(s)
          </p>
        </div>
        <PartnerPromoteButton />
      </div>

      {/* Filters */}
      <form className="flex gap-3 flex-wrap">
        <input
          name="search"
          defaultValue={search}
          placeholder="Buscar por nome ou e-mail..."
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60 w-72"
        />
        <select
          name="tier"
          defaultValue={tier}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/60"
        >
          <option value="">Todos os níveis</option>
          {Object.entries(TIER_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/60"
        >
          <option value="">Todos status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Filtrar
        </button>
      </form>

      {/* Atalhos */}
      <div className="flex gap-3">
        <Link
          href="/admin/partners/payouts"
          className="px-4 py-2 rounded-lg border border-zinc-800 hover:border-amber-500/40 hover:bg-zinc-900 text-sm text-zinc-200 transition-colors flex items-center gap-2"
        >
          <TrendingUp className="w-4 h-4 text-amber-400" /> Fila de Repasses
        </Link>
        <Link
          href="/admin/partners/settings"
          className="px-4 py-2 rounded-lg border border-zinc-800 hover:border-amber-500/40 hover:bg-zinc-900 text-sm text-zinc-200 transition-colors"
        >
          Configurações do Programa
        </Link>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3">Parceiro</th>
                <th className="text-left px-5 py-3">Nível</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">
                  <Users className="w-3 h-3 inline mr-1" /> Orgs ativas
                </th>
                <th className="text-right px-5 py-3">Total ganho</th>
                <th className="text-right px-5 py-3">Total pago</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {partners.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                        {p.user.image ? (
                          <img
                            src={p.user.image}
                            alt={p.user.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-zinc-300 font-semibold">
                            {p.user.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">{p.user.name}</p>
                        <p className="text-[11px] text-zinc-500">
                          {p.user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {p.tier ? (
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${TIER_COLOR[p.tier]}`}
                      >
                        {TIER_LABEL[p.tier]}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500">—</span>
                    )}
                    {p.manualTierOverride && (
                      <span className="ml-2 text-[10px] text-amber-400">
                        manual
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLOR[p.status]}`}
                    >
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-zinc-200 font-semibold">
                    {(activeByUser.get(p.userId) ?? 0).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-5 py-4 text-right text-emerald-400 font-semibold">
                    R${" "}
                    {Number(p.totalEarnedBrl).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-5 py-4 text-right text-zinc-400">
                    R${" "}
                    {Number(p.totalPaidBrl).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/partners/${p.id}`}
                      className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      Detalhes <ChevronRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
              {partners.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-zinc-500 text-sm"
                  >
                    Nenhum parceiro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
            <span>
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`?search=${search}&tier=${tier}&status=${status}&page=${page - 1}`}
                  className="px-3 py-1.5 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  ← Anterior
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`?search=${search}&tier=${tier}&status=${status}&page=${page + 1}`}
                  className="px-3 py-1.5 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                >
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
