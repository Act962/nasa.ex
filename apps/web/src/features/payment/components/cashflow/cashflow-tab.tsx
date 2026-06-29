"use client";

import { useState } from "react";
import { useCashflow } from "../../hooks/use-payment";
import { formatCurrency } from "../../lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function CashflowTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const { data, isLoading } = useCashflow(month, year);

  const rows = data?.rows ?? [];

  const totalIn = rows.reduce((s, r) => s + r.receivable, 0);
  const totalOut = rows.reduce((s, r) => s + r.payable, 0);
  const finalBalance = rows[rows.length - 1]?.balance ?? 0;

  const chartData = rows.map((r) => ({
    dia: r.date.slice(8, 10),
    Entradas: r.receivable / 100,
    Saídas: r.payable / 100,
    Saldo: r.balance / 100,
  }));

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-3">
        <select
          className="text-sm bg-muted border border-border rounded-lg px-3 py-1.5"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {MONTH_NAMES.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          className="text-sm bg-muted border border-border rounded-lg px-3 py-1.5"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {[year - 1, year, year + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <ArrowDownCircle className="size-4" />
              <span className="text-xs font-medium">Total Entradas</span>
            </div>
            <p className="text-xl font-black text-green-400">{formatCurrency(totalIn)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <ArrowUpCircle className="size-4" />
              <span className="text-xs font-medium">Total Saídas</span>
            </div>
            <p className="text-xl font-black text-red-400">{formatCurrency(totalOut)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-400 mb-1">
              <TrendingUp className="size-4" />
              <span className="text-xs font-medium">Saldo Final</span>
            </div>
            <p className={`text-xl font-black ${finalBalance >= 0 ? "text-green-400" : "text-red-400"}`}>
              {formatCurrency(finalBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="size-4 text-blue-400" />
            Fluxo de Caixa Diário
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
          ) : chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Sem dados para o período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cfIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00FF87" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00FF87" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cfOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6B6B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF6B6B" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cfBal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1E90FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1E90FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#888" }} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v) => `${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                <Tooltip
                  contentStyle={{ background: "#0A0E27", border: "1px solid #1E90FF33", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`R$ ${v.toFixed(2)}`, ""]}
                />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="Entradas" stroke="#00FF87" fill="url(#cfIn)" strokeWidth={2} />
                <Area type="monotone" dataKey="Saídas" stroke="#FF6B6B" fill="url(#cfOut)" strokeWidth={2} />
                <Area type="monotone" dataKey="Saldo" stroke="#1E90FF" fill="url(#cfBal)" strokeWidth={2} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      {rows.length > 0 && (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Data</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium text-green-400">Entradas</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium text-red-400">Saídas</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium text-blue-400">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">
                    {new Date(r.date).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-2.5 text-right text-green-400">
                    {r.receivable > 0 ? formatCurrency(r.receivable) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-red-400">
                    {r.payable > 0 ? formatCurrency(r.payable) : "—"}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${r.balance >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {formatCurrency(r.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
