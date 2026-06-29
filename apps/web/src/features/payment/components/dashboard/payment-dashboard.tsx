"use client";

import { useState } from "react";
import { usePaymentDashboard, useCashflow } from "../../hooks/use-payment";
import { formatCurrency } from "../../lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Wallet,
  Clock,
  BarChart3,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const PIE_COLORS = ["#1E90FF", "#00FF87", "#FF6B6B", "#FFD93D", "#C77DFF", "#06BEE1"];

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function fmt(cents: number) {
  return formatCurrency(cents);
}

function KpiCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}) {
  return (
    <Card className="bg-card border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium truncate">{title}</p>
            <p className={`text-xl font-black mt-1 ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ml-3 ${color === "text-green-400" ? "bg-green-500/10" : color === "text-red-400" ? "bg-red-500/10" : color === "text-blue-400" ? "bg-blue-500/10" : "bg-yellow-500/10"}`}>
            <Icon className={`size-4 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PaymentDashboard() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading } = usePaymentDashboard(month, year);
  const { data: cashflowData } = useCashflow(month, year);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted/30" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const monthLabel = `${MONTH_NAMES[month - 1]}/${year}`;

  const chartData = data.monthlyChart.map((m) => ({
    name: m.month.slice(5),
    Receitas: m.receivable / 100,
    Despesas: m.payable / 100,
    Resultado: m.result / 100,
  }));

  const cashflowRows = (cashflowData?.rows ?? []).map((r) => ({
    date: r.date.slice(8, 10),
    Entrada: r.receivable / 100,
    Saída: r.payable / 100,
    Saldo: r.balance / 100,
  }));

  const pieData = data.categoryBreakdown
    .filter((c) => c.type === "PAYABLE" && c.total > 0)
    .slice(0, 6)
    .map((c) => ({ name: c.categoryName, value: c.total / 100 }));

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-3">
        <select
          className="text-sm bg-muted border border-border rounded-lg px-3 py-1.5 focus:outline-none"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {MONTH_NAMES.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          className="text-sm bg-muted border border-border rounded-lg px-3 py-1.5 focus:outline-none"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {[year - 2, year - 1, year, year + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">{monthLabel}</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="A Receber"
          value={fmt(data.totalReceivable)}
          icon={ArrowDownCircle}
          color="text-green-400"
          subtitle="No mês"
        />
        <KpiCard
          title="A Pagar"
          value={fmt(data.totalPayable)}
          icon={ArrowUpCircle}
          color="text-red-400"
          subtitle="No mês"
        />
        <KpiCard
          title="Recebido"
          value={fmt(data.totalReceived)}
          icon={TrendingUp}
          color="text-blue-400"
          subtitle="Confirmado"
        />
        <KpiCard
          title="Resultado"
          value={fmt(data.netResult)}
          icon={data.netResult >= 0 ? TrendingUp : TrendingDown}
          color={data.netResult >= 0 ? "text-green-400" : "text-red-400"}
          subtitle="Receita − Despesa"
        />
        <KpiCard
          title="Saldo em Caixa"
          value={fmt(data.balanceTotal)}
          icon={Wallet}
          color="text-blue-400"
        />
        <KpiCard
          title="Inadimplência"
          value={fmt(data.overdueReceivable)}
          icon={AlertTriangle}
          color="text-yellow-400"
          subtitle="A receber vencido"
        />
        <KpiCard
          title="Próx. 7 dias"
          value={fmt(data.upcoming7Days.receivable)}
          icon={Clock}
          color="text-green-400"
          subtitle="Entradas previstas"
        />
        <KpiCard
          title="Próx. 30 dias"
          value={fmt(data.upcoming30Days.payable)}
          icon={Clock}
          color="text-red-400"
          subtitle="Saídas previstas"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Receita x Despesa (últimos meses) */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="size-4 text-blue-400" />
              Receitas x Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  contentStyle={{ background: "#0A0E27", border: "1px solid #1E90FF33", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`R$ ${v.toFixed(2)}`, ""]}
                />
                <Bar dataKey="Receitas" fill="#00FF87" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#FF6B6B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Fluxo de Caixa do Mês */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="size-4 text-blue-400" />
              Fluxo de Caixa — {monthLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cashflowRows} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1E90FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1E90FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} />
                <Tooltip
                  contentStyle={{ background: "#0A0E27", border: "1px solid #1E90FF33", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`R$ ${v.toFixed(2)}`, ""]}
                />
                <Area type="monotone" dataKey="Saldo" stroke="#1E90FF" fill="url(#colorSaldo)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição de despesas */}
        {pieData.length > 0 && (
          <Card className="bg-card border-border/50 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Distribuição de Despesas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#0A0E27", border: "1px solid #1E90FF33", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`R$ ${v.toFixed(2)}`, ""]}
                  />
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
