"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Link2, Receipt, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { authClient } from "@/lib/auth-client";
import { formatDecimalToMoney } from "@/utils/mask-money";
import { phoneMaskFull } from "@/utils/format-phone";
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
} from "./receipt-draft";
import { ReceiptItemsEditor } from "./receipt-items-editor";

const MAX_INSTALLMENTS = 24;

interface ReceiptPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadPhone: string | null;
  /** Motivo para não enviar na conversa (sem telefone, sem número conectado); `null` = pode enviar. */
  sendBlockedReason: string | null;
  onSendText: (body: string) => Promise<unknown>;
}

interface IssuedReceipt {
  number: number;
  url: string;
  isSent: boolean;
  hasSendFailed: boolean;
}

function ClientFields({ client, phone, onChange }: { client: ReceiptClientDraft; phone: string | null; onChange: (client: ReceiptClientDraft) => void }) {
  const set = (key: keyof ReceiptClientDraft) => (event: React.ChangeEvent<HTMLInputElement>) => onChange({ ...client, [key]: event.target.value });
  return (
    <div className="grid gap-2">
      <div>
        <Label className="text-xs text-muted-foreground">Nome</Label>
        <Input value={client.name} onChange={set("name")} maxLength={120} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs text-muted-foreground">WhatsApp</Label>
          <Input value={phone ? phoneMaskFull(phone) : "Sem telefone"} disabled />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">CPF ou CNPJ</Label>
          <Input value={client.document} onChange={set("document")} inputMode="numeric" maxLength={20} />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_5.5rem] gap-2">
        <div className="min-w-0">
          <Label className="text-xs text-muted-foreground">Rua</Label>
          <Input value={client.street} onChange={set("street")} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Número</Label>
          <Input value={client.number} onChange={set("number")} />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_1fr_4rem] gap-2">
        <div className="min-w-0">
          <Label className="text-xs text-muted-foreground">Bairro</Label>
          <Input value={client.neighborhood} onChange={set("neighborhood")} />
        </div>
        <div className="min-w-0">
          <Label className="text-xs text-muted-foreground">Cidade</Label>
          <Input value={client.city} onChange={set("city")} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">UF</Label>
          <Input value={client.state} onChange={set("state")} maxLength={2} />
        </div>
      </div>
    </div>
  );
}

function IssuedReceiptView({ issued, onClose }: { issued: IssuedReceipt; onClose: () => void }) {
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const copyLink = async () => {
    await navigator.clipboard.writeText(issued.url);
    setIsLinkCopied(true);
    setTimeout(() => setIsLinkCopied(false), 2000);
  };
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 text-center">
      {issued.hasSendFailed ? <AlertTriangle className="size-12 text-warning" /> : <CheckCircle2 className="size-12 text-success" />}
      <p className="text-lg font-semibold">Recibo nº {String(issued.number).padStart(4, "0")} emitido</p>
      <p className="text-sm text-muted-foreground">
        {issued.isSent
          ? "O link do recibo foi enviado na conversa."
          : issued.hasSendFailed
            ? "A venda ficou registrada, mas a mensagem não foi enviada. Copie o link e mande ao cliente."
            : "A venda ficou registrada. Copie o link para mandar ao cliente."}
      </p>
      <div className="flex w-full items-center gap-2 rounded-lg border bg-muted/40 p-2">
        <span className="min-w-0 flex-1 truncate text-left text-xs">{issued.url}</span>
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={copyLink}>
          {isLinkCopied ? <Check className="size-4" /> : <Link2 className="size-4" />}
          {isLinkCopied ? "Copiado" : "Copiar link"}
        </Button>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Button asChild variant="outline" className="h-11 gap-2">
          <a href={issued.url} target="_blank" rel="noopener noreferrer">
            <Receipt className="size-4" /> Ver recibo
          </a>
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
}

function ReceiptForm({
  initialDraft,
  organization,
  leadId,
  leadPhone,
  sendBlockedReason,
  onSendText,
  onClose,
}: Omit<ReceiptPanelProps, "open" | "onOpenChange"> & { initialDraft: ReceiptDraft; organization: ReceiptOrganization; onClose: () => void }) {
  const [draft, setDraft] = useState(initialDraft);
  const [issued, setIssued] = useState<IssuedReceipt | null>(null);
  const [isSending, setIsSending] = useState(false);
  const registerSale = useRegisterSale();
  const preview = useMemo(() => toReceiptPreview(draft, organization), [draft, organization]);
  const blocker = receiptBlocker(draft);
  const total = receiptTotal(draft.items);
  const isBusy = registerSale.isPending || isSending;

  // Dois toques seguidos chegam antes de o botão desabilitar: o ref segura o segundo (spec 0151, CA-5).
  const isSubmittingRef = useRef(false);
  const issue = (shouldSend: boolean) => {
    if (isSubmittingRef.current || blocker) return;
    isSubmittingRef.current = true;
    registerSale.mutate(toRegisterSaleInput(draft, leadId), {
      onSuccess: async (sale) => {
        emitTourResult({ kind: GUIDE_RESULT_KINDS.saleRegistered });
        const url = `${window.location.origin}/proposta/${sale.publicToken}/recibo`;
        if (!shouldSend || sale.isDuplicate) {
          if (sale.isDuplicate) toast.info("Essa venda já tinha sido registrada agora há pouco.");
          setIssued({ number: sale.number, url, isSent: false, hasSendFailed: false });
          isSubmittingRef.current = false;
          return;
        }
        setIsSending(true);
        try {
          await onSendText(receiptMessage(draft.client.name, url));
          setIssued({ number: sale.number, url, isSent: true, hasSendFailed: false });
        } catch {
          setIssued({ number: sale.number, url, isSent: false, hasSendFailed: true });
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
            <ClientFields client={draft.client} phone={leadPhone} onChange={(client) => setDraft({ ...draft, client })} />
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
      </div>
    </>
  );
}

/** Recibo pelo chat (spec 0151): tela cheia, já preenchida com o lead da conversa, com prévia ao vivo. */
export function ReceiptPanel(props: ReceiptPanelProps) {
  const { open, onOpenChange, leadId } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-3 rounded-none p-4 sm:h-[92dvh] sm:w-[96vw] sm:max-w-[1300px] sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-4" /> Recibo
          </DialogTitle>
        </DialogHeader>
        {open ? <ReceiptPanelBody key={leadId} {...props} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ReceiptPanelBody({ leadId, onClose, ...rest }: ReceiptPanelProps & { onClose: () => void }) {
  const { data: leadData, isLoading } = useQueryLead(leadId);
  const { data: companyData } = useCompanyProfile();
  const { data: forgeData } = useForgeSettings();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const lead = leadData?.lead;
  const company = companyData?.org;

  const organization = useMemo<ReceiptOrganization>(
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

  if (isLoading || !lead) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <OrbitaSpinner className="size-6" />
      </div>
    );
  }

  const initialDraft: ReceiptDraft = {
    client: {
      name: lead.name ?? "",
      document: lead.document ?? "",
      street: lead.addressStreet ?? "",
      number: lead.addressNumber ?? "",
      neighborhood: lead.addressNeighborhood ?? "",
      city: lead.addressCity ?? "",
      state: lead.addressState ?? "",
    },
    items: [EMPTY_RECEIPT_ITEM],
    paymentMethod: "PIX",
    installments: 1,
  };

  return <ReceiptForm {...rest} leadId={leadId} initialDraft={initialDraft} organization={organization} onClose={onClose} />;
}
