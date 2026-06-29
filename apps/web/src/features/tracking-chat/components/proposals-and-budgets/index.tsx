"use client";

import { useState } from "react";
import {
  ChevronRightIcon,
  FileSignatureIcon,
  HammerIcon,
  ListIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BudgetCreateView } from "./budget-create-view";
import { UnifiedHistoryView } from "./unified-history-view";
import { CreateProposalView } from "../forge-panel";

/**
 * Painel mesclado "Propostas e Orçamentos" — substitui os botões
 * separados de "Orçamento" e "Forge" no chat. 3 tabs:
 *
 *  1. **Orçamento Rápido**  → valor + descrição + upload PDF c/ IA.
 *     Cria `PaymentEntry` "A receber" (métricas) e envia ao cliente
 *     como TEXT ou DOCUMENT no WhatsApp.
 *  2. **Proposta Estruturada** → catálogo de produtos do Forge + carrinho.
 *     Cria `ForgeProposal` com link público (sharable).
 *  3. **Histórico** → lista cronológica unificada dos 2 tipos pro lead,
 *     com badges e ações contextuais.
 */
interface ProposalsAndBudgetsPanelProps {
  onClose: () => void;
  conversationId: string;
  trackingId: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  whatsappToken: string;
  /** Insere texto no input da mensagem do chat (usado pra link de proposta). */
  onInsertMessage: (text: string) => void;
  /**
   * Pré-preenchimento quando aberto pela detecção de proposta em upload
   * regular (footer-chat). Quando setado, abre direto na tab "Rápido".
   */
  initialAttach?: {
    key: string;
    name: string;
    mime: string;
    valueCents: number | null;
    description: string;
    confidence: "high" | "medium" | "low";
  } | null;
}

type TabId = "rapido" | "estruturado" | "historico";

export function ProposalsAndBudgetsPanel({
  onClose,
  conversationId,
  trackingId,
  leadId,
  leadName,
  leadPhone,
  whatsappToken,
  onInsertMessage,
  initialAttach,
}: ProposalsAndBudgetsPanelProps) {
  // Quando vem com `initialAttach`, abre direto em "Rápido" pra ver o
  // formulário já preenchido pela IA.
  const [tab, setTab] = useState<TabId>(initialAttach ? "rapido" : "rapido");

  // Sub-estado da tab "Estruturado" — alterna entre lista e criar.
  const [creatingProposal, setCreatingProposal] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="flex max-w-lg flex-col gap-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b px-5 py-3 text-left">
          <div className="flex items-center gap-2">
            <FileSignatureIcon className="size-4 text-emerald-500" />
            <DialogTitle className="text-sm font-semibold">
              Propostas e Orçamentos — {leadName}
            </DialogTitle>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <XIcon className="size-4" />
          </button>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as TabId);
            // Ao sair da tab Estruturado, sai do modo "criando".
            if (v !== "estruturado") setCreatingProposal(false);
          }}
          className="flex w-full flex-col"
        >
          <div className="px-5 pt-3">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="rapido" className="flex items-center gap-1.5">
                <ZapIcon className="size-3.5" />
                Orçamento Rápido
              </TabsTrigger>
              <TabsTrigger
                value="estruturado"
                className="flex items-center gap-1.5"
              >
                <HammerIcon className="size-3.5" />
                Proposta
              </TabsTrigger>
              <TabsTrigger
                value="historico"
                className="flex items-center gap-1.5"
              >
                <ListIcon className="size-3.5" />
                Histórico
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Orçamento Rápido ──────────────────────────────────── */}
          <TabsContent value="rapido" className="m-0 border-none outline-none">
            <BudgetCreateView
              conversationId={conversationId}
              trackingId={trackingId}
              leadId={leadId}
              leadName={leadName}
              leadPhone={leadPhone}
              whatsappToken={whatsappToken}
              onSuccess={() => setTab("historico")}
              initialAttach={initialAttach}
            />
          </TabsContent>

          {/* ── Proposta Estruturada (Forge) ──────────────────────── */}
          <TabsContent
            value="estruturado"
            className="m-0 border-none outline-none"
          >
            {creatingProposal ? (
              <div className="flex flex-col">
                <div className="flex items-center gap-2 px-5 pt-3">
                  <button
                    type="button"
                    onClick={() => setCreatingProposal(false)}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Voltar"
                  >
                    <ChevronRightIcon className="size-4 rotate-180" />
                  </button>
                  <span className="text-sm font-semibold">Nova proposta</span>
                </div>
                <CreateProposalView
                  leadId={leadId}
                  leadName={leadName}
                  onBack={() => setCreatingProposal(false)}
                  onCreated={(_token, number, _title) => {
                    setCreatingProposal(false);
                    setTab("historico");
                    toast.success(
                      `Proposta #${String(number).padStart(4, "0")} criada! Veja no histórico pra enviar o link.`,
                    );
                  }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
                <HammerIcon className="size-8 text-muted-foreground/50" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    Criar proposta estruturada
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Monte uma proposta com produtos do catálogo Forge e envie
                    um link público sharable pro cliente.
                  </p>
                </div>
                <Button onClick={() => setCreatingProposal(true)}>
                  <HammerIcon className="size-3.5 mr-1.5" />
                  Nova proposta
                </Button>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Propostas já criadas aparecem na aba <strong>Histórico</strong>.
                </p>
              </div>
            )}
          </TabsContent>

          {/* ── Histórico Unificado ───────────────────────────────── */}
          <TabsContent
            value="historico"
            className="m-0 border-none outline-none"
          >
            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              <UnifiedHistoryView
                leadId={leadId}
                leadName={leadName}
                onInsertMessage={(text) => {
                  onInsertMessage(text);
                  onClose();
                }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
