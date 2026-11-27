"use client";

import { useState } from "react";
import { Check, Download, Link2 } from "lucide-react";
import { useConstructUrl as constructUrl } from "@/hooks/use-construct-url";
import { formatDecimalToMoney } from "@/utils/mask-money";
import { reaisPorExtenso } from "@/features/forge/utils/reais-por-extenso";
import { describeSalePayment, type SalePaymentMethod } from "@/features/forge/lib/sale-payment";

export interface SaleReceiptData {
  /** `null` na prévia do chat, antes de a venda existir. */
  number: number | null;
  paidAt: string;
  paymentMethod: SalePaymentMethod | null;
  installments: number | null;
  proposalDiscount: number;
  organization: {
    name: string;
    logo: string | null;
    cnpj: string | null;
    contactPhone: string | null;
    addressLine: string | null;
    city: string | null;
    state: string | null;
  };
  /** `document` já chega mascarado do servidor quando é CPF. */
  client: { name: string; document: string | null; address: string | null } | null;
  items: { name: string; description: string | null; quantity: number; unitValue: number; discount: number }[];
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const Blank = ({ width }: { width: number }) => (
  <span className="mx-1 inline-block max-w-[60%] translate-y-[-4px] border-b-2 border-neutral-900" style={{ width }} />
);

export function SaleReceiptCard({ receipt }: { receipt: SaleReceiptData }) {
  const subtotal = receipt.items.reduce((sum, item) => sum + item.quantity * item.unitValue, 0);
  const itemsDiscount = receipt.items.reduce((sum, item) => sum + item.discount, 0);
  const discount = itemsDiscount + receipt.proposalDiscount;
  const total = subtotal - discount;
  const paidAt = new Date(receipt.paidAt);
  const organization = receipt.organization;
  const city = [organization.city, organization.state].filter(Boolean).join(" - ");
  const payment = describeSalePayment(receipt.paymentMethod, receipt.installments);
  const quantityLabel = receipt.items.map((item) => `${item.quantity} ${item.name}`).join(", ");

  return (
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-xl print:rounded-none print:shadow-none">
        <header className="flex flex-wrap items-center justify-between gap-4 bg-neutral-950 px-6 py-6 text-white sm:px-10">
          {organization.logo ? (
            <img src={constructUrl(organization.logo)} alt={organization.name} className="h-16 max-w-56 object-contain object-left" />
          ) : (
            <p className="text-2xl font-bold">{organization.name}</p>
          )}
          <div className="text-right">
            <p className="text-4xl font-black tracking-widest">RECIBO</p>
            {organization.cnpj ? <p className="mt-1 text-sm text-neutral-300">CNPJ {organization.cnpj}</p> : null}
            <p className="text-sm text-neutral-300">{[city, organization.contactPhone].filter(Boolean).join(" · ")}</p>
          </div>
        </header>

        <section className="space-y-6 px-6 py-8 sm:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-bold">Nº {receipt.number === null ? "----" : String(receipt.number).padStart(4, "0")}</p>
            <p className="rounded-xl bg-neutral-900 px-5 py-2 text-2xl font-black text-white">{formatDecimalToMoney(total)}</p>
          </div>

          <p className="text-lg leading-9">
            Recebemos de {receipt.client ? <strong className="border-b-2 border-neutral-900">{receipt.client.name}</strong> : <Blank width={320} />}
            {", CPF/CNPJ "}
            {receipt.client?.document ? <strong>{receipt.client.document}</strong> : <Blank width={180} />}
            {receipt.client?.address ? <>, endereço {receipt.client.address}</> : null}, a importância de <strong>{formatDecimalToMoney(total)}</strong> (
            <strong>{reaisPorExtenso(total)}</strong>), referente à compra de {quantityLabel}, conforme abaixo.
          </p>

          <div className="overflow-hidden rounded-xl border-2 border-neutral-900">
            <div className="grid grid-cols-[1fr_36px_96px] sm:grid-cols-[1fr_60px_130px] bg-neutral-900 px-4 py-3 text-sm font-bold text-white">
              <span>DESCRIÇÃO</span>
              <span className="text-center">QTD</span>
              <span className="whitespace-nowrap text-right">VALOR</span>
            </div>
            {receipt.items.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_36px_96px] sm:grid-cols-[1fr_60px_130px] border-t px-4 py-3">
                <span className="font-medium">
                  {item.name}
                  {item.description ? <span className="block text-sm font-normal text-neutral-600">{item.description}</span> : null}
                </span>
                <span className="text-center">{item.quantity}</span>
                <span className="whitespace-nowrap text-right">{formatDecimalToMoney(item.quantity * item.unitValue)}</span>
              </div>
            ))}
            {discount > 0 ? (
              <div className="grid grid-cols-[1fr_96px] sm:grid-cols-[1fr_130px] border-t px-4 py-3 font-medium text-green-700">
                <span>Desconto</span>
                <span className="whitespace-nowrap text-right">− {formatDecimalToMoney(discount)}</span>
              </div>
            ) : null}
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t bg-neutral-100 px-4 py-3 text-base sm:text-lg font-black">
              <span>TOTAL RECEBIDO</span>
              <span className="whitespace-nowrap text-right">{formatDecimalToMoney(total)}</span>
            </div>
          </div>

          {payment ? (
            <p className="text-lg">
              Forma de pagamento: <strong>{payment}</strong>
            </p>
          ) : null}

          <p className="text-lg">
            {organization.city ?? "Local"}, {paidAt.getDate()} de {MONTHS[paidAt.getMonth()]} de {paidAt.getFullYear()}.
          </p>

          <div className="flex flex-col items-center pt-12">
            <div className="w-72 border-t-2 border-neutral-900" />
            <p className="mt-2 font-bold">{organization.name}</p>
            {organization.cnpj ? <p className="text-sm text-neutral-600">CNPJ {organization.cnpj}</p> : null}
          </div>
        </section>

        {organization.addressLine ? (
          <footer className="bg-neutral-950 px-6 py-3 text-center text-sm text-neutral-300">{[organization.addressLine, city].filter(Boolean).join(" · ")}</footer>
        ) : null}
      </div>
  );
}

export function SaleReceipt({ receipt }: { receipt: SaleReceiptData }) {
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const copyReceiptLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setIsLinkCopied(true);
    setTimeout(() => setIsLinkCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-neutral-200 px-3 py-6 text-neutral-900 print:bg-white print:p-0">
      <SaleReceiptCard receipt={receipt} />

      <div className="forge-no-print mx-auto mt-5 flex flex-wrap justify-center gap-3">
        <button
          onClick={copyReceiptLink}
          className="flex items-center gap-2 rounded-xl border-2 border-neutral-900 bg-white px-5 py-3 text-sm font-semibold text-neutral-900"
        >
          {isLinkCopied ? <Check className="size-4" /> : <Link2 className="size-4" />}
          {isLinkCopied ? "Link copiado" : "Copiar link"}
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white"
        >
          <Download className="size-4" /> Salvar como PDF
        </button>
      </div>
    </main>
  );
}
