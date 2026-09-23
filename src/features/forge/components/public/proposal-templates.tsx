"use client";

import { CheckCircle2, CreditCard, Download, FileText } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { useConstructUrl as constructUrl } from "@/hooks/use-construct-url";
import { AcceptButton } from "./parts/accept-button";
import { CompanyInfoBlock } from "./parts/company-info-block";
import { NasaPoweredBy } from "./parts/nasa-powered-by";

export type TemplateId = "standard";
export const TEMPLATE_LIST = [
  {
    id: "standard" as const,
    name: "Proposta N.A.S.A.",
    desc: "Modelo único, legível e otimizado para conversão.",
    preview: "bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950",
  },
];

export interface TemplateProduct {
  id: string;
  quantity: string;
  unitValue: string;
  discount: string | null;
  description: string | null;
  product: {
    id: string;
    name: string;
    unit: string;
    imageUrl: string | null;
    description: string | null;
  };
}
export interface SimulationBreakdown {
  recurring: { label: string; monthly: number }[];
  oneTime: { label: string; amount: number }[];
  termMonths: number;
  validityLabel: string;
  monthlyTotal: number;
  oneTimeTotal: number;
  contractTotal: number;
}

export interface TemplateProposal {
  title: string;
  number: number;
  status: string;
  description: string | null;
  validUntil: string | null;
  discount: string | null;
  discountType: string | null;
  paymentLink: string | null;
  createdAt?: string | null;
  breakdown?: SimulationBreakdown | null;
  products: TemplateProduct[];
  organization: {
    name: string;
    logo: string | null;
    slug?: string | null;
    cnpj?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    addressLine?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    website?: string | null;
    bio?: string | null;
  };
  client: {
    name: string;
    email: string | null;
    phone: string | null;
    document?: string | null;
    profile?: string | null;
  } | null;
  responsible?: { name: string; image: string | null } | null;
  settings: {
    logoUrl: string | null;
    letterheadHeader: string | null;
    letterheadFooter: string | null;
    proposalBgColor: string;
  } | null;
}
export interface TemplateEcosystemLinks {
  agendaUrl: string | null;
  agendaLabel: string | null;
  spaceHomeUrl: string | null;
  linnkerUrl: string | null;
  nasaRouteUrl: string | null;
  nasaRouteCount: number;
}

export function fmt(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function calcTotals(proposal: TemplateProposal) {
  const subtotal = proposal.products.reduce(
    (sum, item) =>
      sum +
      Number(item.quantity) * Number(item.unitValue) -
      Number(item.discount ?? 0),
    0,
  );
  const discountAmount = proposal.discount
    ? proposal.discountType === "PERCENTUAL"
      ? subtotal * (Number(proposal.discount) / 100)
      : Number(proposal.discount)
    : 0;
  return { subtotal, discountAmount, total: subtotal - discountAmount };
}

function ProductImage({ product }: { product: TemplateProduct["product"] }) {
  if (!product.imageUrl)
    return (
      <div className="aspect-[4/3] bg-slate-100 grid place-items-center text-slate-400">
        <FileText className="size-8" />
      </div>
    );
  return (
    <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
      <img
        src={constructUrl(product.imageUrl)}
        alt={product.name}
        className="size-full object-contain"
      />
    </div>
  );
}

export function TemplateModern({
  proposal,
  isExpired,
  isPaid,
  token,
}: {
  proposal: TemplateProposal;
  isExpired: boolean;
  isPaid: boolean;
  token: string;
  ecosystemLinks: TemplateEcosystemLinks;
}) {
  const { subtotal, discountAmount, total } = calcTotals(proposal);
  const logo = proposal.settings?.logoUrl ?? proposal.organization.logo;
  const hasPayment = Boolean(proposal.paymentLink) && !isExpired && !isPaid;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950 selection:bg-violet-200">
      {isExpired ? (
        <div className="bg-amber-100 px-4 py-3 text-center text-base font-semibold text-amber-950">
          Esta proposta expirou.
        </div>
      ) : null}
      {isPaid ? (
        <div className="bg-emerald-600 px-4 py-3 text-center text-base font-semibold text-white">
          <CheckCircle2 className="mr-2 inline size-5" />
          Pagamento confirmado. Obrigado!
        </div>
      ) : null}
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-10 lg:px-12">
          <div className="flex items-center justify-between gap-5 border-b border-white/15 pb-6">
            <div className="min-w-0">
              {logo ? (
                <img
                  src={constructUrl(logo)}
                  alt={proposal.organization.name}
                  className="h-11 max-w-44 object-contain object-left"
                />
              ) : (
                <p className="text-xl font-bold">
                  {proposal.organization.name}
                </p>
              )}
            </div>
            <p className="shrink-0 text-sm font-medium text-slate-300">
              Proposta #{String(proposal.number).padStart(4, "0")}
            </p>
          </div>
          <div className="max-w-4xl py-12 sm:py-16">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">
              Proposta comercial
            </p>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              {proposal.title}
            </h1>
            {proposal.client ? (
              <p className="mt-6 text-lg text-slate-300 sm:text-xl">
                Preparada para{" "}
                <span className="font-semibold text-white">
                  {proposal.client.name}
                </span>
              </p>
            ) : null}
            {proposal.validUntil ? (
              <p className="mt-3 text-base text-slate-400">
                Válida até{" "}
                {new Date(proposal.validUntil).toLocaleDateString("pt-BR")}
              </p>
            ) : null}
          </div>
        </div>
      </section>
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-12">
        <div className="min-w-0 space-y-10">
          {proposal.description ? (
            <div
              className="prose prose-slate max-w-none text-lg leading-8"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(proposal.description),
              }}
            />
          ) : null}
          {proposal.breakdown ? (
            <section className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Investimento mensal (recorrente)</h2>
                <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                  {proposal.breakdown.recurring.map((line) => (
                    <div key={line.label} className="flex items-center justify-between gap-4 p-4">
                      <span className="text-base text-slate-700">{line.label}</span>
                      <span className="font-semibold tabular-nums">{fmt(line.monthly)}/mês</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-4 bg-slate-50 p-4">
                    <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">Total mensal</span>
                    <span className="text-xl font-bold tabular-nums">{fmt(proposal.breakdown.monthlyTotal)}/mês</span>
                  </div>
                </div>
              </div>
              {proposal.breakdown.oneTime.length > 0 ? (
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Cobranças únicas</h2>
                  <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                    {proposal.breakdown.oneTime.map((line) => (
                      <div key={line.label} className="flex items-center justify-between gap-4 p-4">
                        <span className="text-base text-slate-700">{line.label}</span>
                        <span className="font-semibold tabular-nums">{fmt(line.amount)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-4 bg-slate-50 p-4">
                      <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">Total único</span>
                      <span className="text-xl font-bold tabular-nums">{fmt(proposal.breakdown.oneTimeTotal)}</span>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap items-baseline justify-between gap-3 rounded-2xl border-2 border-violet-300 bg-violet-50 p-5">
                <div>
                  <p className="text-sm font-semibold text-violet-800">Valor total do contrato</p>
                  <p className="text-sm text-slate-500">
                    Vigência {proposal.breakdown.validityLabel} · {proposal.breakdown.termMonths} × mensal + cobranças únicas
                  </p>
                </div>
                <span className="text-3xl font-black tabular-nums text-violet-800">
                  {fmt(proposal.breakdown.contractTotal)}
                </span>
              </div>
            </section>
          ) : proposal.products.length > 0 ? (
            <section>
              <h2 className="text-2xl font-bold tracking-tight">
                Escopo da proposta
              </h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {proposal.products.map((item) => {
                  const lineTotal =
                    Number(item.quantity) * Number(item.unitValue) -
                    Number(item.discount ?? 0);
                  return (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                    >
                      <ProductImage product={item.product} />
                      <div className="p-5">
                        <h3 className="text-xl font-bold">
                          {item.product.name}
                        </h3>
                        {(item.description ?? item.product.description) ? (
                          <p className="mt-2 text-base leading-6 text-slate-600">
                            {item.description ?? item.product.description}
                          </p>
                        ) : null}
                        <div className="mt-5 flex items-end justify-between gap-4 border-t border-slate-100 pt-4">
                          <span className="text-sm text-slate-500">
                            {Number(item.quantity).toLocaleString("pt-BR")}{" "}
                            {item.product.unit}
                          </span>
                          <span className="text-lg font-bold">
                            {fmt(lineTotal)}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
          <CompanyInfoBlock
            organization={proposal.organization}
            variant="light"
          />
          <AcceptButton
            token={token}
            client={proposal.client}
            isExpired={isExpired}
            isPaid={isPaid}
            variant="light"
          />
        </div>
        <aside className="self-start lg:sticky lg:top-6">
          <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Investimento
            </p>
            {proposal.breakdown ? (
              <div className="mt-5 space-y-3 text-base tabular-nums">
                <div className="flex justify-between gap-4 text-slate-600">
                  <span>Mensal</span>
                  <span>{fmt(proposal.breakdown.monthlyTotal)}/mês</span>
                </div>
                {proposal.breakdown.oneTimeTotal > 0 ? (
                  <div className="flex justify-between gap-4 text-slate-600">
                    <span>Cobrança única</span>
                    <span>{fmt(proposal.breakdown.oneTimeTotal)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-t border-slate-200 pt-4 text-2xl font-bold">
                  <span>Total do contrato</span>
                  <span>{fmt(proposal.breakdown.contractTotal)}</span>
                </div>
                <p className="text-sm text-slate-500">Vigência {proposal.breakdown.validityLabel}</p>
              </div>
            ) : (
              <div className="mt-5 space-y-3 text-base">
                <div className="flex justify-between gap-4 text-slate-600">
                  <span>Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                {discountAmount > 0 ? (
                  <div className="flex justify-between gap-4 text-emerald-700">
                    <span>Desconto</span>
                    <span>− {fmt(discountAmount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-t border-slate-200 pt-4 text-2xl font-bold">
                  <span>Total</span>
                  <span>{fmt(total)}</span>
                </div>
              </div>
            )}
            {hasPayment ? (
              <a
                href={proposal.paymentLink!}
                target="_blank"
                rel="noopener noreferrer"
                className="forge-no-print mt-6 flex min-h-14 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-base font-bold text-white transition-colors hover:bg-violet-800"
              >
                <CreditCard className="size-5" />
                Pagar com segurança
              </a>
            ) : null}
            {!hasPayment && !isPaid && !isExpired ? (
              <p className="mt-6 rounded-xl bg-slate-100 p-4 text-sm leading-5 text-slate-600">
                A forma de pagamento será combinada com a empresa responsável.
              </p>
            ) : null}
            <button
              onClick={() => window.print()}
              className="forge-pdf-btn mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              <Download className="size-4" />
              Salvar como PDF
            </button>
          </div>
        </aside>
      </div>
      <footer className="border-t border-slate-200 px-5 py-8 text-center">
        <NasaPoweredBy variant="light" />
      </footer>
    </main>
  );
}
