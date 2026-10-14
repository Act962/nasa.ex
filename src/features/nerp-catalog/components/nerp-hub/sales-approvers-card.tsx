"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2Icon, WorkflowIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useQueryListForms } from "@/features/form/hooks/use-form";
import { SALES_ROUND_LABEL, SALES_SECTOR_LABEL, type SalesRound, type SalesSector } from "../../lib/approvals/approval-rules";
import {
  useInstallGuidedSaleFlows,
  useRemoveSalesApprover,
  useSalesApprovers,
  useSaveSalesApprover,
} from "../../hooks/use-sales-approvals";

const SECTORS = Object.keys(SALES_SECTOR_LABEL) as SalesSector[];
const ROUNDS = Object.keys(SALES_ROUND_LABEL) as SalesRound[];

const DEFAULT_ROUNDS_BY_SECTOR: Record<SalesSector, SalesRound[]> = {
  COMMERCIAL: ["PRE_PAYMENT"],
  FINANCE: ["PRE_PAYMENT", "POST_PAYMENT"],
  LOGISTICS: ["PRE_PAYMENT", "POST_PAYMENT"],
  ACCOUNTING: ["PRE_PAYMENT"],
};

// Spec 0104, RF-8: quem aprova a venda do catálogo, por setor, e o atalho para os fluxos prontos.
export function SalesApproversCard({ canEdit }: { canEdit: boolean }) {
  const approvers = useSalesApprovers();
  const saveApprover = useSaveSalesApprover();
  const removeApprover = useRemoveSalesApprover();
  const installFlows = useInstallGuidedSaleFlows();
  const [userId, setUserId] = useState("");
  const [sector, setSector] = useState<SalesSector>("COMMERCIAL");
  const [rounds, setRounds] = useState<SalesRound[]>(DEFAULT_ROUNDS_BY_SECTOR.COMMERCIAL);
  const [phone, setPhone] = useState("");
  const [hasOptIn, setHasOptIn] = useState(false);
  const [registrationFormId, setRegistrationFormId] = useState("");
  const { forms } = useQueryListForms();

  function handleSectorChange(nextSector: SalesSector) {
    setSector(nextSector);
    setRounds(DEFAULT_ROUNDS_BY_SECTOR[nextSector]);
  }

  function handleSave() {
    saveApprover.mutate(
      { userId, sector, rounds, phone, hasOptIn, isActive: true },
      {
        onSuccess: () => {
          toast.success("Aprovador salvo.");
          setUserId("");
          setPhone("");
          setHasOptIn(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function handleInstallFlows() {
    installFlows.mutate(
      { registrationFormId: registrationFormId || undefined },
      {
        onSuccess: (result) =>
          toast.success(`${result.workflowIds.length} fluxos criados em Gatilhos Automáticos, pausados. Revise e ligue.`),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  const data = approvers.data;
  return (
    <Card id="venda-guiada" data-guide={GUIDE_ANCHORS.salesApproversCard.id}>
      <CardHeader>
        <CardTitle>Venda guiada · aprovação dos setores</CardTitle>
        <CardDescription>
          Quem aprova o pedido antes do valor ir ao cliente e confere depois do pagamento. Cada pessoa recebe pelo
          WhatsApp oficial da loja (template de utilidade) e responde pelos botões.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {approvers.isLoading || !data ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            {data.approvers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum aprovador ainda. Sem aprovadores, o valor vai direto ao cliente.</p>
            ) : (
              <ul className="flex flex-col divide-y rounded-md border">
                {data.approvers.map((approver) => (
                  <li key={approver.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <span className="font-medium">{approver.userName}</span>
                    <Badge variant="outline">{SALES_SECTOR_LABEL[approver.sector]}</Badge>
                    <span className="text-muted-foreground tabular-nums">+{approver.phone}</span>
                    <span className="text-xs text-muted-foreground">{approver.rounds.map((round) => SALES_ROUND_LABEL[round]).join(" · ")}</span>
                    {!approver.hasOptIn && <Badge variant="destructive">sem aceite</Badge>}
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-auto size-7"
                        aria-label={`Remover ${approver.userName}`}
                        onClick={() => removeApprover.mutate({ approverId: approver.id }, { onError: (error) => toast.error(error.message) })}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canEdit && (
              <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Pessoa</Label>
                  <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um membro" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Setor</Label>
                  <Select value={sector} onValueChange={(value) => handleSectorChange(value as SalesSector)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTORS.map((sectorOption) => (
                        <SelectItem key={sectorOption} value={sectorOption}>
                          {SALES_SECTOR_LABEL[sectorOption]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">WhatsApp (com DDD)</Label>
                  <Input inputMode="tel" placeholder="86 99999-0000" value={phone} onChange={(event) => setPhone(event.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs">Aprova</Label>
                  {ROUNDS.map((round) => (
                    <label key={round} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={rounds.includes(round)}
                        onCheckedChange={(checked) =>
                          setRounds((current) => (checked === true ? [...current.filter((item) => item !== round), round] : current.filter((item) => item !== round)))
                        }
                      />
                      {SALES_ROUND_LABEL[round]}
                    </label>
                  ))}
                </div>
                <label className="flex items-start gap-2 text-sm sm:col-span-2">
                  <Checkbox checked={hasOptIn} onCheckedChange={(checked) => setHasOptIn(checked === true)} />
                  <span>A pessoa concordou em receber mensagens de aprovação da loja neste WhatsApp (exigência da Meta).</span>
                </label>
                <div className="sm:col-span-2">
                  <Button onClick={handleSave} disabled={!userId || !phone || rounds.length === 0 || !hasOptIn || saveApprover.isPending}>
                    {saveApprover.isPending ? "Salvando…" : "Adicionar aprovador"}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 rounded-md bg-muted/40 p-3 text-sm">
              <p className="font-medium">Fluxos prontos da venda guiada</p>
              <p className="text-muted-foreground">
                Cria nos Gatilhos Automáticos do funil do catálogo: chegada do pedido, aprovação do valor e
                pagamento/liberação. Nascem pausados para você revisar textos e setores.
              </p>
              {canEdit && (
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Formulário de cadastro do cliente novo (depois do pagamento)</Label>
                  <Select value={registrationFormId || "none"} onValueChange={(value) => setRegistrationFormId(value === "none" ? "" : value)}>
                    <SelectTrigger className="max-w-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem cadastro</SelectItem>
                      {forms.map((form) => (
                        <SelectItem key={form.id} value={form.id}>
                          {form.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Nome, telefone, CPF e endereço do pedido já entram preenchidos; só pergunta o que faltar.</p>
                </div>
              )}
              {canEdit && (
                <Button variant="outline" className="w-fit gap-1.5" onClick={handleInstallFlows} disabled={installFlows.isPending}>
                  <WorkflowIcon className="size-4" />
                  {installFlows.isPending ? "Criando…" : "Criar fluxos prontos"}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Templates usados: {Object.values(data.templates).join(", ")}.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
