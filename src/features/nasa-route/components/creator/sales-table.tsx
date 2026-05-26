"use client";

/**
 * Vendas — dashboard do criador.
 *
 * Duas abas:
 *  - "Confirmadas" → matrículas pagas (NasaRouteEnrollment) com comprador,
 *    valor BRL, IDs Stripe e payout em Stars.
 *  - "Pendentes"  → checkouts iniciados que ainda não viraram matrícula
 *    (PendingCoursePurchase). Útil pra acompanhar funil + público anônimo
 *    aguardando resgate via signupToken.
 *
 * A versão anterior listava só `StarTransaction.COURSE_PAYOUT` (extrato de
 * Stars recebidos). O código está preservado em comentário ao final do
 * arquivo caso seja útil reintroduzir como aba "Payouts" futuramente.
 */

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  useNasaRouteSales,
  useNasaRoutePendingSales,
} from "@/features/nasa-route/hooks/use-nasa-route-sales";

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatBrl(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const SOURCE_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  stripe_purchase: { label: "Stripe", variant: "default" },
  purchase: { label: "Stars", variant: "secondary" },
  free_access: { label: "Acesso grátis", variant: "outline" },
  gift: { label: "Presente", variant: "outline" },
};

const PENDING_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Aguardando pagamento", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  PAID: { label: "Pago — aguardando resgate", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" },
  EXPIRED: { label: "Token expirado", className: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200" },
  CANCELLED: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
  REDEEMED: { label: "Resgatado", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
};

export function SalesTable() {
  const [search, setSearch] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");

  const salesQuery = useNasaRouteSales({
    search: search || undefined,
    pageSize: 100,
  });
  const pendingQuery = useNasaRoutePendingSales({
    search: pendingSearch || undefined,
    pageSize: 100,
  });

  const sales = salesQuery.data?.sales ?? [];
  const totals = salesQuery.data?.totals;
  const pending = pendingQuery.data?.pending ?? [];
  const pendingCounts = pendingQuery.data?.countsByStatus ?? {};

  const pendingHotCount =
    (pendingCounts["PENDING"] ?? 0) + (pendingCounts["PAID"] ?? 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/nasa-route/criador"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Voltar para o painel
      </Link>

      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe as matrículas pagas e o funil de checkout em aberto.
          </p>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <KpiCard
          icon={<TrendingUp className="size-5" />}
          label="Total faturado"
          value={
            salesQuery.isLoading ? null : formatBrl(totals?.paidBrlCents ?? 0)
          }
          tone="emerald"
        />
        <KpiCard
          icon={<Users className="size-5" />}
          label="Vendas confirmadas"
          value={
            salesQuery.isLoading
              ? null
              : (totals?.count ?? 0).toLocaleString("pt-BR")
          }
          tone="blue"
        />
        <KpiCard
          icon={<Sparkles className="size-5" />}
          label="Payout em Stars"
          value={
            salesQuery.isLoading
              ? null
              : `${(totals?.payoutStars ?? 0).toLocaleString("pt-BR")} ★`
          }
          tone="amber"
        />
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="confirmed" className="mt-6">
        <TabsList>
          <TabsTrigger value="confirmed">
            Confirmadas
            {totals?.count != null && (
              <span className="ml-2 text-xs text-muted-foreground">
                {totals.count}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pendentes
            {pendingHotCount > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">
                {pendingHotCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Confirmadas ─────────────────────────────────────────────── */}
        <TabsContent value="confirmed" className="mt-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou email…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <Th>Data</Th>
                    <Th>Comprador</Th>
                    <Th>Curso / Plano</Th>
                    <Th align="right">Valor (BRL)</Th>
                    <Th align="right">Payout (★)</Th>
                    <Th>Origem</Th>
                    <Th>Stripe</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {salesQuery.isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3" colSpan={8}>
                            <Skeleton className="h-4 w-full" />
                          </td>
                        </tr>
                      ))
                    : sales.map((s) => {
                        const sourceMeta =
                          SOURCE_LABEL[s.source] ?? {
                            label: s.source,
                            variant: "outline" as const,
                          };
                        return (
                          <tr key={s.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                              {dateFmt.format(new Date(s.enrolledAt))}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium">
                                {s.user?.name ?? "—"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {s.user?.email}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium">{s.course.title}</div>
                              {s.plan?.name && (
                                <div className="text-xs text-muted-foreground">
                                  {s.plan.name}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold tabular-nums">
                              {formatBrl(s.paidBrlCents)}
                            </td>
                            <td className="px-4 py-3 text-right text-xs tabular-nums text-muted-foreground">
                              {s.paidStars > 0
                                ? `+${s.paidStars.toLocaleString("pt-BR")} ★`
                                : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={sourceMeta.variant}>
                                {sourceMeta.label}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              {s.stripeCheckoutSessionId ? (
                                <a
                                  href={`https://dashboard.stripe.com/payments/${s.stripePaymentIntentId ?? ""}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                  title={s.stripeCheckoutSessionId}
                                >
                                  Ver
                                  <ExternalLink className="size-3" />
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {s.status === "active" ? (
                                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                                  Ativa
                                </Badge>
                              ) : (
                                <Badge variant="outline">Reembolsada</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  {!salesQuery.isLoading && sales.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-12 text-center text-sm text-muted-foreground"
                      >
                        Nenhuma venda confirmada ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ─── Pendentes ──────────────────────────────────────────────── */}
        <TabsContent value="pending" className="mt-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                placeholder="Buscar por email…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <Th>Iniciado em</Th>
                    <Th>Email</Th>
                    <Th>Curso / Plano</Th>
                    <Th align="right">Valor</Th>
                    <Th>Fluxo</Th>
                    <Th>Status</Th>
                    <Th>Expira</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingQuery.isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3" colSpan={7}>
                            <Skeleton className="h-4 w-full" />
                          </td>
                        </tr>
                      ))
                    : pending.map((p) => {
                        const meta =
                          PENDING_STATUS_LABEL[p.status] ?? {
                            label: p.status,
                            className: "bg-muted text-muted-foreground",
                          };
                        return (
                          <tr key={p.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                              {dateFmt.format(new Date(p.createdAt))}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium">{p.email}</div>
                              {p.user?.name && (
                                <div className="text-xs text-muted-foreground">
                                  {p.user.name}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium">{p.course.title}</div>
                              {p.plan?.name && (
                                <div className="text-xs text-muted-foreground">
                                  {p.plan.name}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold tabular-nums">
                              {formatBrl(p.amountBrlCents)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="capitalize">
                                {p.flow === "authenticated" ? "Autenticado" : "Público"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${meta.className}`}
                              >
                                {meta.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {p.tokenExpiresAt ? (
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="size-3" />
                                  {dateFmt.format(new Date(p.tokenExpiresAt))}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  {!pendingQuery.isLoading && pending.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-12 text-center text-sm text-muted-foreground"
                      >
                        Nenhuma compra pendente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-3 font-semibold ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  tone: "emerald" | "blue" | "amber";
}) {
  const toneClass = {
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-300",
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-300",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300",
  }[tone];

  const iconBg = {
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    amber: "bg-amber-500",
  }[tone];

  return (
    <div className={`rounded-2xl border p-5 ${toneClass}`}>
      <div className="flex items-center gap-3">
        <div
          className={`flex size-10 items-center justify-center rounded-full text-white ${iconBg}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider opacity-80">{label}</p>
          {value == null ? (
            <Skeleton className="mt-1 h-7 w-28" />
          ) : (
            <p className="text-2xl font-bold tabular-nums">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTAÇÃO ANTERIOR — extrato de Stars recebidos (COURSE_PAYOUT).
// Preservada para referência caso queiramos reintroduzir como aba "Payouts".
//
// import { useQuery } from "@tanstack/react-query";
// import { orpc } from "@/lib/orpc";
//
// const { data } = useQuery({
//   ...orpc.nasaRoute.creatorListSales.queryOptions(),
// });
// // data: { transactions: Array<{ id, amount, balanceAfter, description, createdAt }>, totalEarned }
//
// <table>
//   <thead>
//     <tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Saldo após</th></tr>
//   </thead>
//   <tbody>
//     {data.transactions.map(t => (
//       <tr key={t.id}>
//         <td>{new Date(t.createdAt).toLocaleDateString("pt-BR")}</td>
//         <td>{t.description}</td>
//         <td>+{t.amount} ★</td>
//         <td>{t.balanceAfter} ★</td>
//       </tr>
//     ))}
//   </tbody>
// </table>
// ─────────────────────────────────────────────────────────────────────────────
