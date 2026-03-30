"use client";

/**
 * Proposal Templates — 5 visual models for public proposal landing pages.
 * Template choice is stored in proposal.headerConfig.template
 *
 * PDF print requirements:
 *  - Elements never cut across page breaks (break-inside: avoid on cards/rows)
 *  - Running header on every page: logo + org name + proposal ref
 *  - Running footer on every page: creator name + creation date + branding
 *  - Product images always visible
 */

import { ShoppingCart, CheckCircle2, Zap, Star, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export type TemplateId = "modern" | "clean" | "corporate" | "bold" | "premium";

export const TEMPLATE_LIST: { id: TemplateId; name: string; desc: string; preview: string }[] = [
  { id: "modern",    name: "Modern",    desc: "Fundo escuro com cards de produto em destaque", preview: "bg-gradient-to-br from-slate-900 to-purple-950" },
  { id: "clean",     name: "Clean",     desc: "Minimalista branco, tipografia refinada",        preview: "bg-white border-2 border-gray-200" },
  { id: "corporate", name: "Corporate", desc: "Profissional azul corporativo, tabela clara",    preview: "bg-gradient-to-br from-blue-700 to-blue-900" },
  { id: "bold",      name: "Bold",      desc: "Alto contraste, tipografia de impacto",          preview: "bg-black" },
  { id: "premium",   name: "Premium",   desc: "Luxo escuro com detalhes dourados",              preview: "bg-gradient-to-br from-neutral-900 to-stone-900" },
];

// ─── Shared types ──────────────────────────────────────────────────────────────

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
  responsibleName?: string | null;
  products: TemplateProduct[];
  organization: { name: string; logo: string | null };
  client: { name: string; email: string | null; phone: string | null } | null;
  settings: {
    logoUrl: string | null;
    letterheadHeader: string | null;
    letterheadFooter: string | null;
    proposalBgColor: string;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function calcTotals(proposal: TemplateProposal) {
  const subtotal = proposal.products.reduce((s, pp) =>
    s + Number(pp.quantity) * Number(pp.unitValue) - Number(pp.discount ?? 0), 0);
  const discountAmount = proposal.discount
    ? proposal.discountType === "PERCENTUAL"
      ? subtotal * (Number(proposal.discount) / 100)
      : Number(proposal.discount)
    : 0;
  return { subtotal, discountAmount, total: subtotal - discountAmount };
}

// ─── Print-only running header (repeats on every PDF page) ────────────────────
// Screen: hidden via CSS class "forge-print-header"
// Print:  position: fixed, top: 0 → sits in the @page top margin

function PrintRunningHeader({
  logo,
  orgName,
  number,
  title,
}: {
  logo: string | null;
  orgName: string;
  number: number;
  title: string;
}) {
  return (
    <div className="forge-print-header" aria-hidden="true">
      {/* Left: logo + org name */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {logo && (
          <img
            src={logo}
            alt={orgName}
            style={{ height: "26px", objectFit: "contain", maxWidth: "80px" }}
          />
        )}
        <span style={{ fontWeight: 700, fontSize: "10pt", color: "#1f2937" }}>
          {orgName}
        </span>
      </div>
      {/* Right: title + number */}
      <span style={{ fontFamily: "monospace", fontSize: "9pt", color: "#6b7280", textAlign: "right", maxWidth: "55%" }}>
        {title} · #{String(number).padStart(4, "0")}
      </span>
    </div>
  );
}

// ─── Print-only running footer (repeats on every PDF page) ────────────────────

function PrintRunningFooter({
  orgName,
  responsibleName,
  createdAt,
}: {
  orgName: string;
  responsibleName?: string | null;
  createdAt?: string | null;
}) {
  const dateStr = createdAt
    ? new Date(createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "";

  const left = [
    responsibleName ? `Criado por ${responsibleName}` : null,
    dateStr || null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div className="forge-print-footer" aria-hidden="true">
      <span>{left}</span>
      <span style={{ color: "#9ca3af" }}>{orgName} · FORGE · N.A.S.A®</span>
    </div>
  );
}

// ─── Template: MODERN ─────────────────────────────────────────────────────────

export function TemplateModern({
  proposal,
  isExpired,
  isPaid,
}: {
  proposal: TemplateProposal;
  isExpired: boolean;
  isPaid: boolean;
}) {
  const { total, subtotal, discountAmount } = calcTotals(proposal);
  const logo = proposal.settings?.logoUrl ?? proposal.organization.logo;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Print running elements */}
      <PrintRunningHeader
        logo={logo}
        orgName={proposal.organization.name}
        number={proposal.number}
        title={proposal.title}
      />
      <PrintRunningFooter
        orgName={proposal.organization.name}
        responsibleName={proposal.responsibleName}
        createdAt={proposal.createdAt}
      />

      {/* Status */}
      {isExpired && !isPaid && (
        <div className="bg-red-600 text-white text-sm flex items-center justify-center gap-2 px-6 py-2.5 font-medium forge-no-print">
          ⚠ Proposta expirada em {new Date(proposal.validUntil!).toLocaleDateString("pt-BR")}
        </div>
      )}
      {isPaid && (
        <div className="bg-emerald-600 text-white text-sm flex items-center justify-center gap-2 px-6 py-2.5 font-medium forge-no-print">
          <CheckCircle2 className="size-4" /> Proposta paga — obrigado!
        </div>
      )}

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#7C3AED]/30 via-slate-900 to-slate-950 px-8 py-16 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.2),transparent_60%)]" />
        <div className="relative z-10 max-w-3xl mx-auto space-y-4">
          {logo && (
            <img src={logo} alt="Logo" className="h-14 object-contain mx-auto" />
          )}
          <p className="text-[#a78bfa] text-xs font-mono uppercase tracking-widest">
            Proposta Comercial #{String(proposal.number).padStart(4, "0")}
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            {proposal.title}
          </h1>
          {proposal.client && (
            <p className="text-slate-400 text-sm">
              Para: <strong className="text-white">{proposal.client.name}</strong>
            </p>
          )}
          {proposal.validUntil && (
            <p className="text-slate-500 text-xs">
              Válida até {new Date(proposal.validUntil).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      {proposal.description && (
        <div className="max-w-3xl mx-auto px-8 py-8 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
          {proposal.description}
        </div>
      )}

      {/* Products grid */}
      {proposal.products.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 pb-8">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest text-center mb-6">
            O que está incluído
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "16px",
            }}
          >
            {proposal.products.map((pp) => {
              const lineTotal =
                Number(pp.quantity) * Number(pp.unitValue) - Number(pp.discount ?? 0);
              return (
                <div
                  key={pp.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col forge-avoid-break"
                >
                  {/* Product image — always rendered, prominent */}
                  {pp.product.imageUrl ? (
                    <img
                      src={pp.product.imageUrl}
                      alt={pp.product.name}
                      style={{
                        width: "100%",
                        height: "180px",
                        objectFit: "cover",
                        display: "block",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div className="w-full h-24 bg-slate-800 flex items-center justify-center">
                      <span className="text-slate-600 text-xs">Sem imagem</span>
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col gap-3">
                    <div className="flex-1">
                      <p className="font-bold text-base">{pp.product.name}</p>
                      <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                        {pp.description ?? pp.product.description}
                      </p>
                      <p className="text-slate-600 text-xs mt-1">
                        {Number(pp.quantity).toLocaleString("pt-BR")} {pp.product.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-xl font-extrabold text-[#a78bfa]">{fmt(lineTotal)}</p>
                      {proposal.paymentLink && !isPaid && !isExpired && (
                        <a
                          href={proposal.paymentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="forge-no-print mt-2 flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
                        >
                          <ShoppingCart className="size-4" /> Adquira agora
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Totals + Main CTA */}
      <div
        className="max-w-3xl mx-auto px-8 pb-16 forge-avoid-break"
      >
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="flex justify-between text-sm text-slate-400">
            <span>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm text-emerald-400">
              <span>Desconto</span>
              <span>- {fmt(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-2xl font-extrabold border-t border-slate-700 pt-3">
            <span>Total</span>
            <span className="text-[#a78bfa]">{fmt(total)}</span>
          </div>
          {proposal.paymentLink && !isPaid && !isExpired && (
            <a
              href={proposal.paymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="forge-no-print flex items-center justify-center gap-3 bg-gradient-to-r from-[#7C3AED] to-[#a855f7] text-white rounded-xl py-4 text-base font-bold mt-4 hover:opacity-90 transition-opacity shadow-lg shadow-purple-900/40"
            >
              <Zap className="size-5" /> Adquirir agora — {fmt(total)}
            </a>
          )}
        </div>
      </div>

      {/* Screen footer */}
      <div className="border-t border-slate-800 px-8 py-4 text-center text-xs text-slate-600 forge-no-print">
        {proposal.organization.name} · Proposta gerada via FORGE · N.A.S.A®
      </div>
    </div>
  );
}

// ─── Template: CLEAN ──────────────────────────────────────────────────────────

export function TemplateClean({
  proposal,
  isExpired,
  isPaid,
}: {
  proposal: TemplateProposal;
  isExpired: boolean;
  isPaid: boolean;
}) {
  const { total, subtotal, discountAmount } = calcTotals(proposal);
  const logo = proposal.settings?.logoUrl ?? proposal.organization.logo;

  return (
    <div className="min-h-screen bg-gray-50">
      <PrintRunningHeader
        logo={logo}
        orgName={proposal.organization.name}
        number={proposal.number}
        title={proposal.title}
      />
      <PrintRunningFooter
        orgName={proposal.organization.name}
        responsibleName={proposal.responsibleName}
        createdAt={proposal.createdAt}
      />

      {isExpired && !isPaid && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 text-sm flex items-center justify-center gap-2 px-6 py-2.5 forge-no-print">
          ⚠ Proposta expirada em {new Date(proposal.validUntil!).toLocaleDateString("pt-BR")}
        </div>
      )}
      {isPaid && (
        <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-700 text-sm flex items-center justify-center gap-2 px-6 py-2.5 forge-no-print">
          <CheckCircle2 className="size-4" /> Proposta paga — obrigado!
        </div>
      )}

      <div className="max-w-3xl mx-auto bg-white min-h-screen shadow-sm">
        {/* Header */}
        <div
          className="flex items-center justify-between px-10 py-8 border-b forge-avoid-break"
        >
          {logo ? (
            <img src={logo} alt="Logo" className="h-10 object-contain" />
          ) : (
            <p className="font-bold text-xl">{proposal.organization.name}</p>
          )}
          <div className="text-right">
            <p className="text-xs text-gray-400 font-mono">
              #{String(proposal.number).padStart(4, "0")}
            </p>
            {proposal.validUntil && (
              <p className="text-xs text-gray-400">
                Válida até {new Date(proposal.validUntil).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="px-10 py-10 forge-avoid-break">
          {proposal.client && (
            <p className="text-sm text-gray-400 mb-2">Para {proposal.client.name}</p>
          )}
          <h1 className="text-4xl font-black text-gray-900 leading-tight">{proposal.title}</h1>
          {proposal.description && (
            <p className="mt-4 text-gray-500 text-sm leading-relaxed whitespace-pre-wrap">
              {proposal.description}
            </p>
          )}
        </div>

        {/* Products */}
        {proposal.products.length > 0 && (
          <div className="px-10 pb-8 space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Itens da proposta
            </p>
            {proposal.products.map((pp) => {
              const lineTotal =
                Number(pp.quantity) * Number(pp.unitValue) - Number(pp.discount ?? 0);
              return (
                <div
                  key={pp.id}
                  className="border border-gray-100 rounded-xl overflow-hidden forge-avoid-break"
                >
                  {/* Product image (full-width strip) */}
                  {pp.product.imageUrl && (
                    <img
                      src={pp.product.imageUrl}
                      alt={pp.product.name}
                      style={{
                        width: "100%",
                        height: "180px",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  )}
                  <div className="flex items-start gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{pp.product.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {pp.description ?? pp.product.description}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {Number(pp.quantity).toLocaleString("pt-BR")} {pp.product.unit}
                      </p>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-2">
                      <p className="font-bold text-gray-900 text-lg">{fmt(lineTotal)}</p>
                      {proposal.paymentLink && !isPaid && !isExpired && (
                        <a
                          href={proposal.paymentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="forge-no-print text-xs border border-gray-900 text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-900 hover:text-white transition-colors font-medium"
                        >
                          Adquira agora
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Totals */}
        <div
          className="px-10 pb-10 forge-avoid-break"
        >
          <div className="border-t pt-6 space-y-2 max-w-xs ml-auto">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Desconto</span>
                <span>- {fmt(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-2xl text-gray-900 border-t pt-3">
              <span>Total</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
          {proposal.paymentLink && !isPaid && !isExpired && (
            <a
              href={proposal.paymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="forge-no-print mt-6 flex items-center justify-center gap-2 bg-gray-900 text-white rounded-xl py-4 font-bold text-base hover:bg-gray-800 transition-colors"
            >
              <ShoppingCart className="size-5" /> Adquirir proposta — {fmt(total)}
            </a>
          )}
        </div>

        <div className="border-t px-10 py-4 text-xs text-gray-300 text-center forge-no-print">
          {proposal.organization.name} · FORGE · N.A.S.A®
        </div>
      </div>
    </div>
  );
}

// ─── Template: CORPORATE ──────────────────────────────────────────────────────

export function TemplateCorporate({
  proposal,
  isExpired,
  isPaid,
}: {
  proposal: TemplateProposal;
  isExpired: boolean;
  isPaid: boolean;
}) {
  const { total, subtotal, discountAmount } = calcTotals(proposal);
  const logo = proposal.settings?.logoUrl ?? proposal.organization.logo;

  return (
    <div className="min-h-screen bg-slate-100">
      <PrintRunningHeader
        logo={logo}
        orgName={proposal.organization.name}
        number={proposal.number}
        title={proposal.title}
      />
      <PrintRunningFooter
        orgName={proposal.organization.name}
        responsibleName={proposal.responsibleName}
        createdAt={proposal.createdAt}
      />

      {isExpired && !isPaid && (
        <div className="bg-red-600 text-white text-sm text-center py-2 font-medium forge-no-print">
          Proposta expirada em {new Date(proposal.validUntil!).toLocaleDateString("pt-BR")}
        </div>
      )}
      {isPaid && (
        <div className="bg-emerald-600 text-white text-sm text-center py-2 font-medium forge-no-print">
          ✓ Proposta paga
        </div>
      )}

      {/* Blue header */}
      <div
        className="bg-gradient-to-r from-blue-800 to-blue-700 text-white px-8 py-8 forge-avoid-break"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {logo && (
              <img
                src={logo}
                alt="Logo"
                className="h-12 object-contain bg-white/10 p-1.5 rounded"
              />
            )}
            <div>
              <p className="font-bold text-xl">{proposal.organization.name}</p>
              <p className="text-blue-200 text-xs">Proposta Comercial</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold">
              #{String(proposal.number).padStart(4, "0")}
            </p>
            {proposal.validUntil && (
              <p className="text-blue-200 text-xs">
                Válida até {new Date(proposal.validUntil).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Title card */}
        <div
          className="bg-white rounded-xl border border-slate-200 px-8 py-6 shadow-sm forge-avoid-break"
        >
          {proposal.client && (
            <p className="text-sm text-slate-500 mb-1">
              Destinatário:{" "}
              <strong className="text-slate-700">{proposal.client.name}</strong>
            </p>
          )}
          <h1 className="text-2xl font-bold text-slate-900">{proposal.title}</h1>
          {proposal.description && (
            <p className="mt-3 text-slate-500 text-sm leading-relaxed whitespace-pre-wrap">
              {proposal.description}
            </p>
          )}
        </div>

        {/* Products — card per item with image */}
        {proposal.products.length > 0 && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl border border-slate-200 px-8 py-3">
              <p className="font-semibold text-slate-700 text-sm">Produtos e Serviços</p>
            </div>
            {proposal.products.map((pp, i) => {
              const lineTotal =
                Number(pp.quantity) * Number(pp.unitValue) - Number(pp.discount ?? 0);
              return (
                <div
                  key={pp.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm forge-avoid-break"
                >
                  {/* Product image */}
                  {pp.product.imageUrl && (
                    <img
                      src={pp.product.imageUrl}
                      alt={pp.product.name}
                      style={{
                        width: "100%",
                        height: "200px",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  )}
                  <div className="flex items-start justify-between px-8 py-4 gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div
                        className="size-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                      >
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{pp.product.name}</p>
                        {(pp.description ?? pp.product.description) && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {pp.description ?? pp.product.description}
                          </p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">
                          {Number(pp.quantity).toLocaleString("pt-BR")} {pp.product.unit}
                          {" "} · Unitário: {fmt(Number(pp.unitValue))}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-xl text-slate-900">{fmt(lineTotal)}</p>
                      {proposal.paymentLink && !isPaid && !isExpired && (
                        <a
                          href={proposal.paymentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="forge-no-print mt-2 inline-flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                        >
                          <ExternalLink className="size-3" /> Adquirir
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Totals */}
        <div
          className="bg-white rounded-xl border border-slate-200 px-8 py-5 shadow-sm forge-avoid-break"
        >
          <div className="space-y-1 text-sm max-w-xs ml-auto">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Desconto</span>
                <span>- {fmt(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-xl text-blue-800 border-t border-slate-200 pt-2 mt-2">
              <span>Total</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
          {proposal.paymentLink && !isPaid && !isExpired && (
            <a
              href={proposal.paymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="forge-no-print mt-4 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg py-3.5 font-semibold text-sm transition-colors"
            >
              <ExternalLink className="size-4" /> Fechar proposta — Adquirir agora ({fmt(total)})
            </a>
          )}
        </div>
      </div>

      <div className="text-center text-xs text-slate-400 pb-8 forge-no-print">
        {proposal.organization.name} · FORGE · N.A.S.A®
      </div>
    </div>
  );
}

// ─── Template: BOLD ───────────────────────────────────────────────────────────

export function TemplateBold({
  proposal,
  isExpired,
  isPaid,
}: {
  proposal: TemplateProposal;
  isExpired: boolean;
  isPaid: boolean;
}) {
  const { total, discountAmount } = calcTotals(proposal);
  const logo = proposal.settings?.logoUrl ?? proposal.organization.logo;
  const accentColor =
    proposal.settings?.proposalBgColor && proposal.settings.proposalBgColor !== "#ffffff"
      ? proposal.settings.proposalBgColor
      : "#FF4500";

  return (
    <div className="min-h-screen bg-black text-white">
      <PrintRunningHeader
        logo={logo}
        orgName={proposal.organization.name}
        number={proposal.number}
        title={proposal.title}
      />
      <PrintRunningFooter
        orgName={proposal.organization.name}
        responsibleName={proposal.responsibleName}
        createdAt={proposal.createdAt}
      />

      {isExpired && !isPaid && (
        <div className="bg-red-600 text-white text-sm text-center py-2 font-bold forge-no-print">
          ⚠ PROPOSTA EXPIRADA
        </div>
      )}
      {isPaid && (
        <div className="bg-emerald-500 text-black text-sm text-center py-2 font-bold forge-no-print">
          ✓ PAGO — OBRIGADO!
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        {/* Logo + ref */}
        <div
          className="flex items-center justify-between forge-avoid-break"
        >
          {logo ? (
            <img src={logo} alt="Logo" className="h-10 object-contain invert" />
          ) : (
            <p className="text-2xl font-black tracking-tight">{proposal.organization.name}</p>
          )}
          <p className="text-gray-600 font-mono text-sm">
            #{String(proposal.number).padStart(4, "0")}
          </p>
        </div>

        {/* Headline */}
        <div
          className="space-y-4 forge-avoid-break"
        >
          {proposal.client && (
            <p className="text-gray-500 text-sm uppercase tracking-widest">
              Para {proposal.client.name}
            </p>
          )}
          <h1 className="text-5xl md:text-7xl font-black leading-none tracking-tighter">
            {proposal.title}
          </h1>
          {proposal.description && (
            <p className="text-gray-400 text-lg leading-relaxed max-w-2xl whitespace-pre-wrap">
              {proposal.description}
            </p>
          )}
        </div>

        {/* Products */}
        {proposal.products.length > 0 && (
          <div className="space-y-6">
            {proposal.products.map((pp, i) => {
              const lineTotal =
                Number(pp.quantity) * Number(pp.unitValue) - Number(pp.discount ?? 0);
              return (
                <div
                  key={pp.id}
                  className="border border-gray-800 rounded-2xl overflow-hidden forge-avoid-break"
                >
                  {/* Product image */}
                  {pp.product.imageUrl && (
                    <img
                      src={pp.product.imageUrl}
                      alt={pp.product.name}
                      style={{
                        width: "100%",
                        height: "220px",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  )}
                  <div className="flex items-start gap-6 p-6">
                    <div
                      className="size-10 rounded-full bg-gray-900 flex items-center justify-center text-gray-500 font-bold text-xl shrink-0"
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-2xl font-extrabold">{pp.product.name}</p>
                      <p className="text-gray-500 text-sm mt-1">
                        {pp.description ?? pp.product.description}
                      </p>
                      <p className="text-gray-600 text-xs mt-1">
                        {Number(pp.quantity).toLocaleString("pt-BR")} {pp.product.unit}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className="text-3xl font-black"
                        style={{ color: accentColor }}
                      >
                        {fmt(lineTotal)}
                      </p>
                      {proposal.paymentLink && !isPaid && !isExpired && (
                        <a
                          href={proposal.paymentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="forge-no-print mt-2 inline-block text-xs border px-3 py-1 rounded-full hover:bg-white hover:text-black transition-colors"
                          style={{ borderColor: accentColor, color: accentColor }}
                        >
                          QUERO ESTE
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Big CTA */}
        <div
          className="border-t border-gray-800 pt-12 flex flex-col md:flex-row items-start md:items-end justify-between gap-8 forge-avoid-break"
        >
          <div>
            {discountAmount > 0 && (
              <p className="text-gray-600 text-sm">
                Desconto de {fmt(discountAmount)} aplicado
              </p>
            )}
            <p className="text-gray-500 text-sm">TOTAL</p>
            <p
              className="text-6xl md:text-8xl font-black tracking-tighter leading-none"
              style={{ color: accentColor }}
            >
              {fmt(total)}
            </p>
          </div>
          {proposal.paymentLink && !isPaid && !isExpired && (
            <a
              href={proposal.paymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="forge-no-print inline-flex items-center gap-3 text-black font-extrabold text-xl px-10 py-5 rounded-2xl transition-transform hover:scale-105"
              style={{ backgroundColor: accentColor }}
            >
              <Zap className="size-6" /> ADQUIRIR AGORA
            </a>
          )}
        </div>
      </div>

      <div className="border-t border-gray-900 text-center text-xs text-gray-700 py-4 forge-no-print">
        {proposal.organization.name} · FORGE · N.A.S.A®
      </div>
    </div>
  );
}

// ─── Template: PREMIUM ────────────────────────────────────────────────────────

export function TemplatePremium({
  proposal,
  isExpired,
  isPaid,
}: {
  proposal: TemplateProposal;
  isExpired: boolean;
  isPaid: boolean;
}) {
  const { total, subtotal, discountAmount } = calcTotals(proposal);
  const logo = proposal.settings?.logoUrl ?? proposal.organization.logo;

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #111 50%, #1c1508 100%)" }}
    >
      <PrintRunningHeader
        logo={logo}
        orgName={proposal.organization.name}
        number={proposal.number}
        title={proposal.title}
      />
      <PrintRunningFooter
        orgName={proposal.organization.name}
        responsibleName={proposal.responsibleName}
        createdAt={proposal.createdAt}
      />

      {isExpired && !isPaid && (
        <div className="bg-red-900/60 border-b border-red-800 text-red-300 text-sm text-center py-2 forge-no-print">
          Esta proposta expirou
        </div>
      )}
      {isPaid && (
        <div className="bg-emerald-900/60 border-b border-emerald-800 text-emerald-300 text-sm text-center py-2 forge-no-print">
          ✓ Proposta liquidada
        </div>
      )}

      {/* Gold line */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-yellow-600 to-transparent" />

      <div className="max-w-3xl mx-auto px-8 py-12 space-y-10">
        {/* Header */}
        <div
          className="flex items-center justify-between forge-avoid-break"
        >
          {logo ? (
            <img src={logo} alt="" className="h-12 object-contain" />
          ) : (
            <p className="text-yellow-600 font-black text-2xl tracking-widest uppercase">
              {proposal.organization.name}
            </p>
          )}
          <div className="text-right">
            <p className="text-yellow-700/60 text-xs font-mono tracking-widest">PROPOSTA</p>
            <p className="text-yellow-600 font-bold">
              #{String(proposal.number).padStart(4, "0")}
            </p>
            {proposal.validUntil && (
              <p className="text-stone-600 text-xs">
                Válida até {new Date(proposal.validUntil).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </div>

        {/* Title */}
        <div
          className="border-l-2 border-yellow-700 pl-6 forge-avoid-break"
        >
          {proposal.client && (
            <p className="text-stone-400 text-xs uppercase tracking-widest mb-2">
              Para {proposal.client.name}
            </p>
          )}
          <h1 className="text-3xl font-bold text-stone-100 leading-snug">
            {proposal.title}
          </h1>
          {proposal.description && (
            <p className="mt-3 text-stone-400 text-sm leading-relaxed whitespace-pre-wrap">
              {proposal.description}
            </p>
          )}
        </div>

        {/* Products */}
        {proposal.products.length > 0 && (
          <div className="space-y-4">
            <p className="text-yellow-700/60 text-xs uppercase tracking-widest">Itens</p>
            {proposal.products.map((pp) => {
              const lineTotal =
                Number(pp.quantity) * Number(pp.unitValue) - Number(pp.discount ?? 0);
              return (
                <div
                  key={pp.id}
                  className="border border-stone-800 rounded-xl overflow-hidden bg-stone-900/40 forge-avoid-break"
                >
                  {/* Product image */}
                  {pp.product.imageUrl && (
                    <img
                      src={pp.product.imageUrl}
                      alt={pp.product.name}
                      style={{
                        width: "100%",
                        height: "200px",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  )}
                  <div className="flex items-start gap-4 p-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-stone-100">{pp.product.name}</p>
                          <p className="text-stone-500 text-xs mt-0.5">
                            {pp.description ?? pp.product.description}
                          </p>
                          <p className="text-stone-600 text-xs mt-1">
                            {Number(pp.quantity).toLocaleString("pt-BR")} {pp.product.unit}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-yellow-500 font-bold text-xl">{fmt(lineTotal)}</p>
                          {proposal.paymentLink && !isPaid && !isExpired && (
                            <a
                              href={proposal.paymentLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="forge-no-print mt-1.5 inline-block text-[11px] border border-yellow-700 text-yellow-600 px-3 py-1 rounded-full hover:bg-yellow-700 hover:text-black transition-colors"
                            >
                              Adquira agora
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Totals */}
        <div
          className="border-t border-stone-800 pt-8 forge-avoid-break"
        >
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-sm text-stone-500">
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600/80">
                <span>Desconto</span>
                <span>- {fmt(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-end mt-2 pt-3 border-t border-stone-800">
              <span className="text-stone-400 text-sm uppercase tracking-widest">
                Investimento Total
              </span>
              <span className="text-4xl font-extrabold text-yellow-500">{fmt(total)}</span>
            </div>
          </div>

          {proposal.paymentLink && !isPaid && !isExpired && (
            <a
              href={proposal.paymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="forge-no-print flex items-center justify-center gap-3 w-full py-4 rounded-xl font-bold text-base text-black transition-all hover:brightness-110"
              style={{ background: "linear-gradient(135deg, #d4a017, #b8860b)" }}
            >
              <Star className="size-5" /> Adquirir Proposta
            </a>
          )}
        </div>
      </div>

      <div className="h-0.5 bg-gradient-to-r from-transparent via-yellow-800/50 to-transparent" />
      <div className="text-center text-xs text-stone-700 py-4 forge-no-print">
        {proposal.organization.name} · FORGE · N.A.S.A®
      </div>
    </div>
  );
}
