"use client";

import DOMPurify from "isomorphic-dompurify";
import { Banknote, BadgePercent, Check, CreditCard, FileText, Landmark, QrCode, Receipt, Wallet } from "lucide-react";
import { useConstructUrl as constructUrl } from "@/hooks/use-construct-url";
import {
  describePaymentMethod,
  summarizeProposalLine,
  summarizeProposalTotals,
  type ProposalPaymentMethodId,
} from "@/features/forge/lib/proposal-look";
import { AcceptButton } from "../parts/accept-button";
import { companyWhatsappLink, formatDate, formatMoney, initialsOf } from "./format";
import type { DocumentProduct, SectionProps } from "./types";

const PAYMENT_ICONS: Record<ProposalPaymentMethodId, typeof QrCode> = {
  PIX: QrCode,
  CREDITO: CreditCard,
  DEBITO: CreditCard,
  BOLETO: FileText,
  TRANSFERENCIA: Landmark,
  DINHEIRO: Banknote,
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-lg font-bold text-neutral-900">{children}</h2>;
}

function lineValues(item: DocumentProduct) {
  return summarizeProposalLine({ quantity: Number(item.quantity), unitValue: Number(item.unitValue), discount: Number(item.discount ?? 0) });
}

export function proposalTotals(proposal: SectionProps["proposal"]) {
  return summarizeProposalTotals(
    proposal.products.map((item) => ({ quantity: Number(item.quantity), unitValue: Number(item.unitValue), discount: Number(item.discount ?? 0) })),
    { value: Number(proposal.discount ?? 0), type: proposal.discountType },
  );
}

export function ClientSection({ proposal, look }: SectionProps) {
  const facts = [
    proposal.client ? { label: "Cliente", value: proposal.client.name } : null,
    proposal.responsible ? { label: "Responsável", value: proposal.responsible.name } : null,
    proposal.createdAt ? { label: "Emissão", value: formatDate(proposal.createdAt) } : null,
    proposal.validUntil ? { label: "Validade", value: formatDate(proposal.validUntil), isHighlight: true } : null,
  ].filter((fact): fact is { label: string; value: string | null; isHighlight?: boolean } => fact !== null);
  if (facts.length === 0) return null;
  if (look.template === "compact") {
    return (
      <p className="text-sm leading-6 text-neutral-600">
        {facts.map((fact, index) => (
          <span key={fact.label}>
            {index > 0 ? " · " : ""}
            {fact.label}: <strong className="text-neutral-900">{fact.value}</strong>
          </span>
        ))}
      </p>
    );
  }
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-neutral-200 @3xl:grid-cols-4">
      {facts.map((fact) => (
        <div key={fact.label} className="border-b border-r border-neutral-200 px-4 py-3 last:border-r-0 @3xl:border-b-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{fact.label}</dt>
          <dd className={`mt-0.5 font-semibold ${fact.isHighlight ? "text-[var(--brand-text)]" : "text-neutral-900"}`}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DescriptionSection({ proposal }: SectionProps) {
  if (!proposal.description?.trim()) return null;
  return (
    <div
      className="prose prose-neutral max-w-none text-[15px] leading-7 text-neutral-700 [&_*]:text-neutral-700"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(proposal.description) }}
    />
  );
}

function PriceBlock({ item, align }: { item: DocumentProduct; align: "left" | "right" }) {
  const values = lineValues(item);
  const unitFull = Number(item.unitValue);
  return (
    <div className={align === "right" ? "text-right" : ""}>
      {values.discountPercent > 0 ? (
        <p className="whitespace-nowrap text-xs text-neutral-500">
          <s>{formatMoney(unitFull)}</s>
          <span className="ml-1.5 inline-block whitespace-nowrap rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--accent-strong)]">
            {values.discountPercent}% OFF
          </span>
        </p>
      ) : null}
      <p className={`text-base font-bold ${values.discountPercent > 0 ? "text-[var(--accent-strong)]" : "text-neutral-900"}`}>
        {formatMoney(values.finalUnitValue)}
      </p>
    </div>
  );
}

function ItemImage({ item }: { item: DocumentProduct }) {
  return (
    <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--brand-soft)] text-[var(--brand-text)]">
      {item.product.imageUrl ? (
        <img src={constructUrl(item.product.imageUrl)} alt={item.product.name} className="size-full object-cover" />
      ) : (
        <Wallet className="size-6" />
      )}
    </div>
  );
}

function BreakdownTables({ proposal }: SectionProps) {
  const breakdown = proposal.breakdown!;
  const rows = (lines: { label: string; value: string }[], totalLabel: string, total: string) => (
    <div className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200">
      {lines.map((line) => (
        <div key={line.label} className="flex items-center justify-between gap-4 px-4 py-3 text-[15px] text-neutral-800">
          <span>{line.label}</span>
          <span className="whitespace-nowrap font-semibold tabular-nums">{line.value}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 bg-neutral-50 px-4 py-3">
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">{totalLabel}</span>
        <span className="whitespace-nowrap text-lg font-bold tabular-nums text-neutral-900">{total}</span>
      </div>
    </div>
  );
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Investimento mensal (recorrente)</SectionTitle>
        {rows(
          breakdown.recurring.map((line) => ({ label: line.label, value: `${formatMoney(line.monthly)}/mês` })),
          "Total mensal",
          `${formatMoney(breakdown.monthlyTotal)}/mês`,
        )}
      </div>
      {breakdown.oneTime.length > 0 ? (
        <div>
          <SectionTitle>Cobranças únicas</SectionTitle>
          {rows(
            breakdown.oneTime.map((line) => ({ label: line.label, value: formatMoney(line.amount) })),
            "Total único",
            formatMoney(breakdown.oneTimeTotal),
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ItemsSection(props: SectionProps) {
  const { proposal, look } = props;
  if (proposal.breakdown) return <BreakdownTables {...props} />;
  if (proposal.products.length === 0) return null;

  if (look.template === "classic") {
    return (
      <div>
        <SectionTitle>Itens da proposta</SectionTitle>
        <div className="overflow-hidden rounded-xl border border-neutral-300">
          <div className="hidden grid-cols-[1fr_8.5rem_4rem_8rem] gap-4 bg-[var(--brand)] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--brand-ink)] @3xl:grid">
            <span>Item</span>
            <span className="text-right">Valor unit.</span>
            <span className="text-center">Qtd</span>
            <span className="text-right">Subtotal</span>
          </div>
          {proposal.products.map((item) => (
            <div key={item.id} className="grid gap-x-4 gap-y-1 border-t border-neutral-200 px-4 py-3 first:border-t-0 @3xl:grid-cols-[1fr_8.5rem_4rem_8rem] @3xl:items-center">
              <div className="min-w-0">
                <p className="font-semibold text-neutral-900">{item.product.name}</p>
                {item.description ?? item.product.description ? (
                  <p className="text-sm text-neutral-500">{item.description ?? item.product.description}</p>
                ) : null}
              </div>
              <PriceBlock item={item} align="right" />
              <p className="text-sm text-neutral-600 @3xl:text-center">
                <span className="@3xl:hidden">Quantidade: </span>
                {Number(item.quantity).toLocaleString("pt-BR")}
              </p>
              <p className="font-bold tabular-nums text-neutral-900 @3xl:text-right">
                <span className="text-sm font-normal text-neutral-500 @3xl:hidden">Subtotal: </span>
                {formatMoney(lineValues(item).finalTotal)}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isCompact = look.template === "compact";
  return (
    <div>
      <SectionTitle>Itens da proposta</SectionTitle>
      <div className="space-y-2.5">
        {proposal.products.map((item) => (
          <article
            key={item.id}
            className={`grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 border border-neutral-200 p-3.5 @3xl:grid-cols-[auto_1fr_10rem_5rem_8rem] @3xl:items-center @3xl:gap-4 ${isCompact ? "rounded-xl" : "rounded-2xl"}`}
          >
            {isCompact ? <span className="hidden" /> : <ItemImage item={item} />}
            <div className={`min-w-0 ${isCompact ? "col-span-2 @3xl:col-span-2" : ""}`}>
              <p className="font-bold text-neutral-900">{item.product.name}</p>
              {item.description ?? item.product.description ? (
                <p className="text-sm text-neutral-500">{item.description ?? item.product.description}</p>
              ) : null}
            </div>
            <div className="col-span-2 flex items-end justify-between gap-3 @3xl:contents">
              <PriceBlock item={item} align="left" />
              <p className="shrink-0 whitespace-nowrap rounded-lg border border-neutral-200 px-2.5 py-1 text-center text-sm text-neutral-700">
                Qtd: {Number(item.quantity).toLocaleString("pt-BR")}
              </p>
              <div className="text-right">
                <p className="text-[11px] text-neutral-500">Subtotal</p>
                <p className="whitespace-nowrap font-bold tabular-nums text-neutral-900">{formatMoney(lineValues(item).finalTotal)}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function TotalsSection({ proposal, look }: SectionProps) {
  if (proposal.breakdown) {
    return (
      <div className="rounded-2xl bg-[var(--brand-soft)] p-5">
        <p className="text-sm font-semibold text-neutral-700">Valor total do contrato</p>
        <p className="text-3xl font-extrabold tabular-nums text-[var(--brand-text)]">{formatMoney(proposal.breakdown.contractTotal)}</p>
        <p className="mt-1 text-sm text-neutral-600">
          Vigência {proposal.breakdown.validityLabel} · {proposal.breakdown.termMonths} × mensal + cobranças únicas
        </p>
      </div>
    );
  }
  if (proposal.products.length === 0) return null;
  const totals = proposalTotals(proposal);
  const hasDiscount = totals.discountTotal > 0.004;
  return (
    <div className={`rounded-2xl border border-neutral-200 p-5 ${look.template === "compact" ? "" : "@3xl:ml-auto @3xl:max-w-md"}`}>
      {hasDiscount ? (
        <div className="space-y-1.5 text-[15px]">
          <div className="flex justify-between gap-4 text-neutral-700">
            <span>Valor total (preços normais)</span>
            <span className="whitespace-nowrap tabular-nums">{formatMoney(totals.fullTotal)}</span>
          </div>
          <div className="flex justify-between gap-4 text-[var(--accent-strong)]">
            <span>Desconto total</span>
            <span className="whitespace-nowrap tabular-nums">− {formatMoney(totals.discountTotal)}</span>
          </div>
        </div>
      ) : null}
      <div className={`rounded-xl bg-[var(--brand-soft)] p-4 ${hasDiscount ? "mt-3" : ""}`}>
        <p className="text-sm font-semibold text-neutral-700">Investimento total</p>
        <p className="text-3xl font-extrabold tabular-nums text-[var(--brand-text)]">{formatMoney(totals.total)}</p>
        {hasDiscount ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
            <BadgePercent className="size-3.5" />
            Você economiza {formatMoney(totals.discountTotal)} ({totals.savingsPercent}%)
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function PaymentSection({ look }: SectionProps) {
  if (look.paymentMethods.length === 0) return null;
  return (
    <div>
      <SectionTitle>Formas de pagamento</SectionTitle>
      <ul className="grid gap-2 @2xl:grid-cols-2">
        {look.paymentMethods.map((entry) => {
          const Icon = PAYMENT_ICONS[entry.method];
          const { label, detail } = describePaymentMethod(entry);
          return (
            <li key={entry.method} className="flex items-center gap-3 rounded-xl border border-neutral-200 px-3.5 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-text)]">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-neutral-900">{label}</span>
                {detail ? <span className="block text-sm text-neutral-500">{detail}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TermsSection({ look }: SectionProps) {
  if (!look.commercialTerms) return null;
  return (
    <div className="rounded-2xl bg-neutral-50 p-5">
      <p className="font-bold text-neutral-900">Condições comerciais</p>
      <p className="mt-1.5 whitespace-pre-line text-[15px] leading-6 text-neutral-600">{look.commercialTerms}</p>
    </div>
  );
}

export function ResponsibleSection({ proposal }: SectionProps) {
  if (!proposal.responsible) return null;
  const responsible = proposal.responsible;
  return (
    <div className="flex items-center gap-3">
      {responsible.image ? (
        <img src={constructUrl(responsible.image)} alt={responsible.name} className="size-12 rounded-full object-cover" />
      ) : (
        <span className="grid size-12 place-items-center rounded-full bg-[var(--brand)] font-bold text-[var(--brand-ink)]">
          {initialsOf(responsible.name)}
        </span>
      )}
      <div>
        <p className="font-bold text-neutral-900">{responsible.name}</p>
        <p className="text-sm text-neutral-500">Responsável por esta proposta</p>
      </div>
    </div>
  );
}

/** "Vamos fechar negócio?": pagar, aceitar ou falar no WhatsApp, conforme a situação da proposta (spec 0150, RF-8). */
export function CtaSection({ proposal, state }: SectionProps) {
  const { isExpired, isPaid, isPreview, token } = state;
  const whatsappLink = companyWhatsappLink(proposal);
  if (isPaid) {
    return (
      <a
        href={isPreview ? undefined : `/proposta/${token}/recibo`}
        className="forge-no-print flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 font-bold text-[var(--accent-ink)]"
      >
        <Receipt className="size-5" /> Ver recibo
      </a>
    );
  }
  if (isExpired) return null;
  const hasPaymentLink = Boolean(proposal.paymentLink);
  return (
    <div className="forge-no-print flex flex-col gap-4 rounded-2xl bg-[var(--brand)] p-5 text-[var(--brand-ink)] @3xl:flex-row @3xl:items-center @3xl:justify-between">
      <div>
        <p className="text-xl font-extrabold">Vamos fechar negócio?</p>
        <p className="text-sm opacity-85">Estamos à disposição para esclarecer qualquer dúvida.</p>
      </div>
      <div className="flex flex-col gap-2.5 @xl:flex-row @3xl:shrink-0">
        {hasPaymentLink ? (
          <a
            href={isPreview ? undefined : proposal.paymentLink!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 font-bold text-[var(--accent-ink)]"
          >
            <Check className="size-5" /> Pagar com segurança
          </a>
        ) : isPreview ? (
          <span className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 font-bold text-[var(--accent-ink)]">
            <Check className="size-5" /> Aceitar e assinar proposta
          </span>
        ) : (
          <div className="@xl:min-w-64">
            <AcceptButton
              token={token}
              client={proposal.client}
              isExpired={isExpired}
              isPaid={isPaid}
              variant="light"
              accentClassName="min-h-12 py-3"
              accentStyle={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            />
          </div>
        )}
        {whatsappLink ? (
          <a
            href={isPreview ? undefined : whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center justify-center rounded-xl border-2 border-current px-5 font-bold"
          >
            Falar no WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  );
}
