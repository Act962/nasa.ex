"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBps, formatCentsBrl } from "@/features/accounting/lib/format";
import { FiscalTermHint } from "../shared/fiscal-term-hint";

interface CoursePriceRow {
  id: string;
  title: string;
  isPublished: boolean;
  priceCents: number;
  estimatedTaxCents: number;
  netCents: number;
}

interface TrafegoPlanPriceRow {
  id: string;
  name: string;
  adBudgetCents: number;
  serviceFeeCents: number;
  estimatedTaxCents: number;
  netCents: number;
}

interface OtherPricesCardProps {
  serviceRateBps: number;
  courses: CoursePriceRow[];
  trafegoPlans: TrafegoPlanPriceRow[];
}

/** Preços vendidos fora do Forge (cursos do NASA Route, planos do trafeGO) — só leitura. */
export function OtherPricesCard({ serviceRateBps, courses, trafegoPlans }: OtherPricesCardProps) {
  if (courses.length === 0 && trafegoPlans.length === 0) return null;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Outros preços que você vende</CardTitle>
        <p className="text-sm text-muted-foreground">
          Estimativa com a alíquota de serviço ({formatBps(serviceRateBps)}) <FiscalTermHint termId="aliquota-efetiva" />
          . Para mudar o preço, edite no app de origem.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {courses.length > 0 && (
          <div className="overflow-x-auto">
            <p className="mb-2 text-sm font-medium">Cursos (NASA Route)</p>
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 text-left font-medium">Curso</th>
                  <th className="px-3 py-2 text-right font-medium">Preço</th>
                  <th className="px-3 py-2 text-right font-medium">Imposto estimado</th>
                  <th className="py-2 pl-3 text-right font-medium">Sobra</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {courses.map((course) => (
                  <tr key={course.id}>
                    <td className="py-2 pr-3">
                      {course.title}
                      {!course.isPublished && <span className="ml-1 text-xs text-muted-foreground">(rascunho)</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCentsBrl(course.priceCents)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCentsBrl(course.estimatedTaxCents)}</td>
                    <td className="py-2 pl-3 text-right font-medium tabular-nums">{formatCentsBrl(course.netCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {trafegoPlans.length > 0 && (
          <div className="overflow-x-auto">
            <p className="mb-2 text-sm font-medium">Planos do trafeGO (imposto sobre a taxa de serviço)</p>
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3 text-left font-medium">Plano</th>
                  <th className="px-3 py-2 text-right font-medium">Taxa de serviço</th>
                  <th className="px-3 py-2 text-right font-medium">Imposto estimado</th>
                  <th className="py-2 pl-3 text-right font-medium">Sobra</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {trafegoPlans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="py-2 pr-3">
                      {plan.name}
                      <p className="text-xs text-muted-foreground">verba de anúncio {formatCentsBrl(plan.adBudgetCents)}</p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCentsBrl(plan.serviceFeeCents)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCentsBrl(plan.estimatedTaxCents)}</td>
                    <td className="py-2 pl-3 text-right font-medium tabular-nums">{formatCentsBrl(plan.netCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
