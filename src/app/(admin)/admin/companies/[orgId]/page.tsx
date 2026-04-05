import { requireAdminSession } from "@/lib/admin-utils";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { OrgStarsForm } from "@/features/admin/components/org-stars-form";
import { OrgPlanForm } from "@/features/admin/components/org-plan-form";
import { OrgMembersTable } from "@/features/admin/components/org-members-table";
import { OrgActivityLog } from "@/features/admin/components/org-activity-log";

export default async function OrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  await requireAdminSession();
  const { orgId } = await params;

  const [org, plans] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true, name: true, slug: true, logo: true, starsBalance: true,
        planId: true, createdAt: true, metadata: true,
        plan: { select: { id: true, name: true, monthlyStars: true, priceMonthly: true } },
        members: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true, role: true, cargo: true, createdAt: true,
            user: { select: { id: true, name: true, email: true, image: true, isSystemAdmin: true } },
          },
        },
        starTransactions: {
          orderBy: { createdAt: "desc" },
          take: 15,
          select: { id: true, type: true, amount: true, balanceAfter: true, description: true, createdAt: true },
        },
      },
    }),
    prisma.plan.findMany({ orderBy: { priceMonthly: "asc" }, select: { id: true, name: true, monthlyStars: true, priceMonthly: true } }),
  ]);

  if (!org) notFound();

  const txTypeLabel: Record<string, string> = {
    PLAN_CREDIT: "Crédito Plano", TOPUP_PURCHASE: "Recarga",
    APP_CHARGE: "Cobrança App", APP_SETUP: "Setup App",
    ROLLOVER: "Rollover", MANUAL_ADJUST: "Ajuste Manual", REFUND: "Reembolso",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/companies" className="text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">{org.name}</h1>
          <p className="text-sm text-zinc-400">{org.slug} · desde {new Date(org.createdAt).toLocaleDateString("pt-BR")}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2">
          <Star className="w-4 h-4 text-yellow-400" />
          <span className="text-lg font-bold text-yellow-400">{org.starsBalance.toLocaleString("pt-BR")}</span>
          <span className="text-xs text-zinc-400">stars</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stars adjustment */}
        <OrgStarsForm orgId={org.id} currentBalance={org.starsBalance} />

        {/* Plan */}
        <OrgPlanForm
          orgId={org.id}
          currentPlanId={org.planId}
          plans={plans.map((p) => ({ ...p, priceMonthly: Number(p.priceMonthly) }))}
        />
      </div>

      {/* Members */}
      <OrgMembersTable members={org.members} orgId={org.id} orgName={org.name} />

      {/* Activity log */}
      <OrgActivityLog orgId={org.id} members={org.members} />

      {/* Transaction history */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Histórico de Stars</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
                <th className="text-left py-2 pr-4">Tipo</th>
                <th className="text-right py-2 pr-4">Valor</th>
                <th className="text-right py-2 pr-4">Saldo após</th>
                <th className="text-left py-2 pr-4">Descrição</th>
                <th className="text-right py-2">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {org.starTransactions.map((tx) => (
                <tr key={tx.id} className="text-xs">
                  <td className="py-2 pr-4 text-zinc-400">{txTypeLabel[tx.type] ?? tx.type}</td>
                  <td className={`py-2 pr-4 text-right font-semibold ${tx.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2 pr-4 text-right text-zinc-300">{tx.balanceAfter.toLocaleString("pt-BR")}</td>
                  <td className="py-2 pr-4 text-zinc-400 max-w-xs truncate">{tx.description}</td>
                  <td className="py-2 text-right text-zinc-500">
                    {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
