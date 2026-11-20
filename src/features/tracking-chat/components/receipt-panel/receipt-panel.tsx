"use client";

import { useMemo, useRef, useState } from "react";
import { Receipt, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { authClient } from "@/lib/auth-client";
import { formatDecimalToMoney } from "@/utils/mask-money";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { emitTourResult } from "@/features/tour/store";
import { useQueryLead } from "@/features/leads/hooks/use-lead";
import { useCompanyProfile } from "@/features/settings/hooks/use-company-profile";
import { useForgeSettings } from "@/features/forge/hooks/use-forge";
import { useRegisterSale } from "@/features/forge/hooks/use-forge-sales";
import { SaleReceiptCard } from "@/features/forge/components/public/sale-receipt";
import { PAYMENT_METHOD_LABELS, type SalePaymentMethod } from "@/features/forge/lib/sale-payment";
import {
  EMPTY_RECEIPT_ITEM,
  receiptBlocker,
  receiptMessage,
  receiptTotal,
  toReceiptPreview,
  toRegisterSaleInput,
  type ReceiptClientDraft,
  type ReceiptDraft,
  type ReceiptOrganization,
  type ReceiptTarget,
} from "./receipt-draft";
import { ReceiptItemsEditor } from "./receipt-items-editor";
import { ReceiptClientFields } from "./receipt-client-fields";
import { IssuedReceiptView, type IssuedReceipt } from "./issued-receipt-view";

const MAX_INSTALLMENTS = 24;

/** Recibo da conversa aberta (envia o link nela) ou avulso pelo menu do chat (cria ou acha o lead pelo telefone). */
export type ReceiptPanelMode =
  | {
      kind: "conversation";
      leadId: string;
      leadPhone: string | null;
      /** Motivo para não enviar na conversa (ex.: sem número conectado); `null` = pode enviar. */
      sendBlockedReason: string | null;
      onSendText: (body: string) => Promise<unknown>;
    }
  | { kind: "standalone"; trackingId: string };

const EMPTY_CLIENT: ReceiptClientDraft = { name: "", phone: "", document: "", street: "", number: "", neighborhood: "", city: "", state: "" };

function newDraft(client: ReceiptClientDraft): ReceiptDraft {
  return { client, items: [EMPTY_RECEIPT_ITEM], paymentMethod: "PIX", installments: 1 };
}

function ReceiptForm({
  mode,
  fixedPhone,
  initialDraft,
  organization,
  onClose,
}: {
  mode: ReceiptPanelMode;
  fixedPhone: string | null;
  initialDraft: ReceiptDraft;
  organization: ReceiptOrganization;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [issued, setIssued] = useState<IssuedReceipt | null>(null);
  const [isSending, setIsSending] = useState(false);
  const registerSale = useRegisterSale();
  const preview = useMemo(() => toReceiptPreview(draft, organization), [draft, organization]);
  const isStandalone = mode.kind === "standalone";
  const blocker = receiptBlocker(draft, { isPhoneRequired: isStandalone });
  const sendBlockedReason = mode.kind === "conversation" ? mode.sendBlockedReason : null;
  const total = receiptTotal(draft.items);
  const isBusy = registerSale.isPending || isSending;
  const target: ReceiptTarget = mode.kind === "conversation" ? { leadId: mode.leadId } : { trackingId: mode.trackingId };

  // Dois toques seguidos chegam antes de o botão desabilitar: o ref segura o segundo (spec 0151, CA-5).
  const isSubmittingRef = useRef(false);
  const issue = (shouldSend: boolean) => {
    if (isSubmittingRef.current || blocker) return;
    isSubmittingRef.current = true;
    registerSale.mutate(toRegisterSaleInput(draft, target), {
      onSuccess: async (sale) => {
        emitTourResult({ kind: GUIDE_RESULT_KINDS.saleRegistered });
        const base = {
          number: sale.number,
          url: `${window.location.origin}/proposta/${sale.publicToken}/recibo`,
          clientName: draft.client.name,
          // No chat o link vai na própria conversa; no avulso, só se a conversa estiver na janela de 24h.
          openWhatsapp: isStandalone ? sale.openWhatsapp : null,
        };
        if (sale.isDuplicate) toast.info("Essa venda já tinha sido registrada agora há pouco.");
        if (!shouldSend || sale.isDuplicate || mode.kind !== "conversation") {
          setIssued({ ...base, isSent: false, hasSendFailed: false });
          isSubmittingRef.current = false;
          return;
        }
        setIsSending(true);
        try {
          await mode.onSendText(receiptMessage(draft.client.name, base.url));
          setIssued({ ...base, isSent: true, hasSendFailed: false });
        } catch {
          setIssued({ ...base, isSent: false, hasSendFailed: true });
        } finally {
          setIsSending(false);
          isSubmittingRef.current = false;
        }
      },
      onError: (error) => {
        toast.error(error.message || "Não foi possível emitir o recibo.");
        isSubmittingRef.current = false;
      },
    });
  };

  if (issued) return <IssuedReceiptView issued={issued} onClose={onClose} />;

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[440px_1fr] lg:gap-5 lg:overflow-hidden">
        <div className="space-y-5 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Cliente</h3>
            {isStandalone || sendBlockedReason ? (
              <p className="text-xs text-muted-foreground">Se o número já for de um cliente, o recibo vai para ele; senão, o cliente entra no funil.</p>
            ) : null}
            <ReceiptClientFields
              client={draft.client}
              fixedPhone={fixedPhone}
              isRequired={isStandalone}
              onChange={(client) => setDraft({ ...draft, client })}
            />
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Itens</h3>
            <ReceiptItemsEditor items={draft.items} onChange={(items) => setDraft({ ...draft, items })} />
          </section>
          <section className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Pagamento</Label>
              <Select value={draft.paymentMethod} onValueChange={(value) => setDraft({ ...draft, paymentMethod: value as SalePaymentMethod })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([method, label]) => (
                    <SelectItem key={method} value={method}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {draft.paymentMethod === "CREDITO" ? (
              <div>
                <Label className="text-xs text-muted-foreground">Parcelas</Label>
                <Input
                  type="number"
                  min={1}
                  max={MAX_INSTALLMENTS}
                  value={draft.installments}
                  onChange={(event) =>
                    setDraft({ ...draft, installments: Math.min(MAX_INSTALLMENTS, Math.max(1, Number(event.target.value) || 1)) })
                  }
                />
              </div>
            ) : null}
          </section>
        </div>

        <section className="mt-6 space-y-2 lg:mt-0 lg:flex lg:min-h-0 lg:flex-col">
          <h3 className="text-sm font-semibold">Prévia</h3>
          <div className="rounded-xl bg-neutral-200 p-2 sm:p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <SaleReceiptCard receipt={preview} />
          </div>
        </section>
      </div>

      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-bold">{formatDecimalToMoney(total)}</span>
        </div>
        {blocker ? <p className="text-xs text-destructive">{blocker}</p> : null}
        {!blocker && sendBlockedReason ? <p className="text-xs text-muted-foreground">{sendBlockedReason}</p> : null}
        {isStandalone ? (
          <Button
            type="button"
            className="h-11 w-full gap-2 sm:ml-auto sm:flex sm:w-auto"
            disabled={Boolean(blocker) || isBusy}
            onClick={() => issue(false)}
            data-guide={GUIDE_ANCHORS.chatReceiptSubmit.id}
          >
            {isBusy ? <OrbitaSpinner className="size-4" /> : <Receipt className="size-4" />}
            Gerar recibo
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button type="button" variant="outline" className="h-11" disabled={Boolean(blocker) || isBusy} onClick={() => issue(false)}>
              Só gerar
            </Button>
            <Button
              type="button"
              className="h-11 gap-2"
              disabled={Boolean(blocker) || Boolean(sendBlockedReason) || isBusy}
              onClick={() => issue(true)}
              data-guide={GUIDE_ANCHORS.chatReceiptSubmit.id}
            >
              {isBusy ? <OrbitaSpinner className="size-4" /> : <Send className="size-4" />}
              Gerar e enviar
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function useReceiptOrganization(): ReceiptOrganization {
  const { data: companyData } = useCompanyProfile();
  const { data: forgeData } = useForgeSettings();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const company = companyData?.org;
  return useMemo(
    () => ({
      name: company?.name ?? activeOrganization?.name ?? "Sua empresa",
      logo: activeOrganization?.logo ?? forgeData?.settings.logoUrl ?? null,
      cnpj: company?.cnpj ?? null,
      contactPhone: company?.contactPhone ?? null,
      addressLine: company?.addressLine ?? null,
      city: company?.city ?? null,
      state: company?.state ?? null,
    }),
    [company, activeOrganization?.name, activeOrganization?.logo, forgeData?.settings.logoUrl],
  );
}

function ConversationReceiptBody({ mode, onClose }: { mode: Extract<ReceiptPanelMode, { kind: "conversation" }>; onClose: () => void }) {
  const { data: leadData, isLoading } = useQueryLead(mode.leadId);
  const organization = useReceiptOrganization();
  const lead = leadData?.lead;
  if (isLoading || !lead) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <OrbitaSpinner className="size-6" />
      </div>
    );
  }
  const initialDraft = newDraft({
    ...EMPTY_CLIENT,
    name: lead.name ?? "",
    document: lead.document ?? "",
    street: lead.addressStreet ?? "",
    number: lead.addressNumber ?? "",
    neighborhood: lead.addressNeighborhood ?? "",
    city: lead.addressCity ?? "",
    state: lead.addressState ?? "",
  });
  return (
    <ReceiptForm mode={mode} fixedPhone={lead.phone ?? mode.leadPhone} initialDraft={initialDraft} organization={organization} onClose={onClose} />
  );
}

function StandaloneReceiptBody({ mode, onClose }: { mode: Extract<ReceiptPanelMode, { kind: "standalone" }>; onClose: () => void }) {
  const organization = useReceiptOrganization();
  return <ReceiptForm mode={mode} fixedPhone={null} initialDraft={newDraft(EMPTY_CLIENT)} organization={organization} onClose={onClose} />;
}

/** Recibo pelo chat (spec 0151): tela cheia com prévia ao vivo. */
export function ReceiptPanel({ open, onOpenChange, mode }: { open: boolean; onOpenChange: (open: boolean) => void; mode: ReceiptPanelMode }) {
  const close = () => onOpenChange(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-3 rounded-none p-4 sm:h-[92dvh] sm:w-[96vw] sm:max-w-[1300px] sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-4" /> {mode.kind === "standalone" ? "Recibo avulso" : "Recibo"}
          </DialogTitle>
        </DialogHeader>
        {open && mode.kind === "conversation" ? <ConversationReceiptBody key={mode.leadId} mode={mode} onClose={close} /> : null}
        {open && mode.kind === "standalone" ? <StandaloneReceiptBody mode={mode} onClose={close} /> : null}
      </DialogContent>
    </Dialog>
  );
}
