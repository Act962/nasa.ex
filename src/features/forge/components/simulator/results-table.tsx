"use client";

import { formatBrl, formatTokens } from "@/features/ia/lib/token-pricing";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  CostSimulatorResult,
  BidSimulatorResult,
  ExequibilidadeFlag,
} from "@/features/forge/lib/cost-simulator";

const flagBadge: Record<ExequibilidadeFlag, { label: string; className: string }> = {
  OK: { label: "OK", className: "bg-emerald-100 text-emerald-700" },
  EXCESSIVO: { label: "Excessivo", className: "bg-red-100 text-red-700" },
  INEXEQUIVEL: { label: "Inexequível", className: "bg-amber-100 text-amber-700" },
};

type FeeLine = { label: string; amount: number };

export function CommercialResultsTable({
  result,
  showInternal,
  monthlyFees = [],
  oneTimeFees = [],
  taxRate = 0,
  termMonths = 1,
  validityLabel = "",
}: {
  result: CostSimulatorResult;
  showInternal: boolean;
  monthlyFees?: FeeLine[];
  oneTimeFees?: FeeLine[];
  taxRate?: number;
  termMonths?: number;
  validityLabel?: string;
}) {
  const round2 = (value: number) => Math.round(value * 100) / 100;
  const monthlyExtra = monthlyFees.reduce((total, fee) => total + fee.amount, 0);
  const oneTime = oneTimeFees.reduce((total, fee) => total + fee.amount, 0);
  const monthlySubtotal = result.clientPriceBrl + monthlyExtra;
  const monthlyTax = round2((monthlySubtotal * taxRate) / 100);
  const monthlyTotal = round2(monthlySubtotal + monthlyTax);
  const oneTimeWithTax = round2(oneTime * (1 + taxRate / 100));
  const proposalTotal = round2(monthlyTotal * termMonths + oneTimeWithTax);
  return (
    <div className="space-y-4">
      {showInternal && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Custo unit.</TableHead>
                <TableHead className="text-right">Custo interno</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.lines.map((line, index) => (
                <TableRow key={`${line.label}-${index}`}>
                  <TableCell className="font-medium">{line.label}</TableCell>
                  <TableCell className="text-right">
                    {line.category === "AI_MODEL"
                      ? String(line.quantity)
                      : formatTokens(line.quantity)}
                  </TableCell>
                  <TableCell>{line.unit}</TableCell>
                  <TableCell className="text-right">{formatBrl(line.unitCostBrl)}</TableCell>
                  <TableCell className="text-right">{formatBrl(line.internalCostBrl)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-1 border-t p-3 text-sm">
            <Row label="Subtotal interno" value={formatBrl(result.internalSubtotalBrl)} />
            <Row
              label={`Margem (${result.markupPercentage}%)`}
              value={formatBrl(result.marginAmountBrl)}
            />
          </div>
        </div>
      )}

      <div className="rounded-lg border-2 border-[#7C3AED]/30 bg-[#7C3AED]/5 p-4 space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Uso recorrente (IA + WhatsApp + infra)</span>
          <span className="font-medium">{formatBrl(result.clientPriceBrl)}/mês</span>
        </div>
        {monthlyFees.map((fee) => (
          <div key={fee.label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">+ {fee.label}</span>
            <span className="font-medium">{formatBrl(fee.amount)}/mês</span>
          </div>
        ))}
        {taxRate > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">+ Impostos ({taxRate}%)</span>
            <span className="font-medium">{formatBrl(monthlyTax)}/mês</span>
          </div>
        )}
        <div className="flex items-end justify-between border-t pt-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Total mensal ao cliente</span>
          <span className="text-2xl font-black text-[#7C3AED]">{formatBrl(monthlyTotal)}</span>
        </div>
        <p className="text-right text-xs text-muted-foreground">
          {formatBrl(result.perUserClientPriceBrl)} por usuário
        </p>
        {oneTimeFees.map((fee) => (
          <div key={fee.label} className="flex items-center justify-between border-t pt-2 text-sm">
            <span className="text-muted-foreground">+ {fee.label} (única)</span>
            <span className="font-semibold">{formatBrl(fee.amount)}</span>
          </div>
        ))}
        {oneTime > 0 && taxRate > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">+ Impostos ({taxRate}%) sobre única</span>
            <span className="font-semibold">{formatBrl(round2(oneTime * (taxRate / 100)))}</span>
          </div>
        )}
        <div className="mt-1 flex items-end justify-between border-t border-[#7C3AED]/30 pt-2">
          <span className="text-xs font-medium text-muted-foreground">
            Valor total da proposta · vigência {validityLabel || `${termMonths} mês(es)`}
          </span>
          <span className="text-lg font-black">{formatBrl(proposalTotal)}</span>
        </div>
      </div>
    </div>
  );
}

export function BidResultsTable({
  result,
  showInternal,
}: {
  result: BidSimulatorResult;
  showInternal: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead>Un.</TableHead>
              {showInternal && <TableHead className="text-right">Custo unit.</TableHead>}
              <TableHead className="text-right">Preço unit.</TableHead>
              <TableHead className="text-right">Mensal (C=B/12)</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Exeq.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((item) => (
              <TableRow key={item.code} className={item.isParent ? "bg-muted/40 font-semibold" : ""}>
                <TableCell>{item.code}</TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell className="text-right">{String(item.quantity)}</TableCell>
                <TableCell>{item.unit}</TableCell>
                {showInternal && (
                  <TableCell className="text-right">{formatBrl(item.internalUnitCostBrl)}</TableCell>
                )}
                <TableCell className="text-right">{formatBrl(item.bidUnitBrl)}</TableCell>
                <TableCell className="text-right">{formatBrl(item.bidMonthlyBrl)}</TableCell>
                <TableCell className="text-right">{formatBrl(item.bidTotalBrl)}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={flagBadge[item.exequibilidade].className}>
                    {flagBadge[item.exequibilidade].label}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex flex-col gap-1 border-t p-3 text-sm">
          {showInternal && (
            <Row label="Custo interno total" value={formatBrl(result.internalTotalBrl)} />
          )}
          {showInternal && <Row label="Margem" value={formatBrl(result.marginAmountBrl)} />}
          <Row label="Total mensal" value={formatBrl(result.bidMonthlyTotalBrl)} />
          <Row label="Total (12 meses)" value={formatBrl(result.bidTotalBrl)} strong />
        </div>
      </div>

      {result.ceilingTotalBrl !== null && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            result.withinCeiling
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {result.withinCeiling
            ? `Dentro do teto do orçamento estimado (${formatBrl(result.ceilingTotalBrl)}).`
            : `Acima do teto do orçamento estimado (${formatBrl(result.ceilingTotalBrl)}) — proposta seria desclassificada.`}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "text-base font-black" : "font-medium"}>{value}</span>
    </div>
  );
}
