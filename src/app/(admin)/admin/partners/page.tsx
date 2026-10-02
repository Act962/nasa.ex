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
  SUITE: "bg-muted text-foreground",
  EARTH: "bg-temp-cold/15 text-temp-cold",
  GALAXY: "bg-temp-warm/15 text-temp-warm",
  CONSTELLATION: "bg-temp-hot/15 text-temp-hot",
  INFINITY: "bg-temp-very-hot/15 text-temp-very-hot",
};

const STATUS_LABEL: Record<PartnerStatus, string> = {
  ELIGIBLE: "Elegível",
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
};

const STATUS_COLOR: Record<PartnerStatus, string> = {
  ELIGIBLE: "bg-knob text-foreground",
  ACTIVE: "bg-success/20 text-success",
  SUSPENDED: "bg-destructive/20 text-destructive",
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
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Handshake className="w-5 h-5 text-warning" /> Parceiros ÓRBITA
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
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
          className="bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring w-72"
        />
        <select
          name="tier"
          defaultValue={tier}
          className="bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring"
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
          className="bg-muted border border-line rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring"
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
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Filtrar
        </button>
      </form>

      {/* Atalhos */}
      <div className="flex gap-3">
        <Link
          href="/admin/partners/payouts"
          className="px-4 py-2 rounded-lg border border-border hover:border-line hover:bg-card text-sm text-foreground transition-colors flex items-center gap-2"
        >
          <TrendingUp className="w-4 h-4 text-warning" /> Fila de Repasses
        </Link>
        <Link
          href="/admin/partners/settings"
          className="px-4 py-2 rounded-lg border border-border hover:border-line hover:bg-card text-sm text-foreground transition-colors"
        >
          Configurações do Programa
        </Link>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
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
            <tbody className="divide-y divide-border">
              {partners.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-knob flex items-center justify-center shrink-0">
                        {p.user.image ? (
                          <img
                            src={p.user.image}
                            alt={p.user.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-foreground font-semibold">
                            {p.user.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{p.user.name}</p>
                        <p className="text-[11px] text-muted-foreground">
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
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                    {p.manualTierOverride && (
                      <span className="ml-2 text-[10px] text-warning">
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
                  <td className="px-5 py-4 text-right text-foreground font-semibold">
                    {(activeByUser.get(p.userId) ?? 0).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-5 py-4 text-right text-success font-semibold">
                    R${" "}
                    {Number(p.totalEarnedBrl).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-5 py-4 text-right text-muted-foreground">
                    R${" "}
                    {Number(p.totalPaidBrl).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/partners/${p.id}`}
                      className="inline-flex items-center gap-1 text-xs text-warning hover:text-warning/80 transition-colors"
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
                    className="px-5 py-10 text-center text-muted-foreground text-sm"
                  >
                    Nenhum parceiro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`?search=${search}&tier=${tier}&status=${status}&page=${page - 1}`}
                  className="px-3 py-1.5 bg-muted rounded-lg hover:bg-knob transition-colors"
                >
                  ← Anterior
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`?search=${search}&tier=${tier}&status=${status}&page=${page + 1}`}
                  className="px-3 py-1.5 bg-muted rounded-lg hover:bg-knob transition-colors"
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
