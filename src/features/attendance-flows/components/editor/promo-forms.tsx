"use client";

// Painéis dos blocos da promoção STAR FRIENDS (spec 0140). As regras da campanha ficam no código da spec 0102; aqui a
// empresa só escolhe de onde vêm o nome e a foto e como o bloco responde.
import { useContext } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAttendanceCampaignStatus } from "../../hooks/use-attendance-flows";
import { PROMO_LOOKUP_VARIABLES, PROMO_RECEIPT_VARIABLES, parsePromoEnroll, parsePromoLookup, parsePromoReceipt } from "../../lib/nodes";
import { ReplyDeadlineField } from "../attendance-node-forms";
import { FlowVariablesContext } from "./variable-textarea";

type NodeData = Record<string, unknown>;
type FormProps = { data: NodeData; onChange: (data: NodeData) => void };

const NONE = "__none__";

function formatDay(value: Date | string): string {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

function CampaignStatus() {
  const { data, isLoading } = useAttendanceCampaignStatus();
  if (isLoading) return null;
  const campaigns = data?.campaigns ?? [];
  if (campaigns.length === 0) {
    return (
      <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        Nenhuma campanha ativa no STAR FRIENDS. Até a empresa criar uma, o bloco segue por &quot;Promoção fechada&quot;.
      </p>
    );
  }
  return (
    <div className="space-y-1 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
      {campaigns.map((campaign) => (
        <p key={campaign.id}>
          <span className="font-medium text-foreground">{campaign.name}</span>, de {formatDay(campaign.startsAt)} a {formatDay(campaign.endsAt)}
          {campaign.numberName ? ` (número ${campaign.numberName})` : " (todos os números)"}
        </p>
      ))}
    </div>
  );
}

function VariableSelect({ value, onChange, emptyLabel }: { value: string; onChange: (value: string) => void; emptyLabel: string }) {
  const flowVariables = useContext(FlowVariablesContext);
  return (
    <Select value={value || NONE} onValueChange={(selected) => onChange(selected === NONE ? "" : selected)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{emptyLabel}</SelectItem>
        {flowVariables.map((name) => (
          <SelectItem key={name} value={name}>
            {`{{vars.${name}}}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function VariablesHint({ names }: { names: readonly string[] }) {
  return <p className="text-xs text-muted-foreground">Grava: {names.map((name) => `{{vars.${name}}}`).join(", ")}.</p>;
}

const ASK_NAME = "__ask__";
const CONTACT_NAME = "__contact__";

/** Perguntar o nome completo (como a campanha de sempre), usar o do contato ou uma variável de uma Pergunta anterior. */
function NameSourceField({ data, onChange }: FormProps) {
  const flowVariables = useContext(FlowVariablesContext);
  const config = parsePromoEnroll(data);
  const value = config.nameSource === "ASK" ? ASK_NAME : config.nameSource === "CONTACT" ? CONTACT_NAME : config.nameVariable;
  const choose = (selected: string) => {
    if (selected === ASK_NAME) onChange({ ...data, nameSource: "ASK", nameVariable: "" });
    else if (selected === CONTACT_NAME) onChange({ ...data, nameSource: "CONTACT", nameVariable: "" });
    else onChange({ ...data, nameSource: "VARIABLE", nameVariable: selected });
  };
  return (
    <div className="space-y-1.5">
      <Label>Nome da inscrição</Label>
      <Select value={value} onValueChange={choose}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ASK_NAME}>Perguntar o nome completo</SelectItem>
          <SelectItem value={CONTACT_NAME}>Nome do contato no WhatsApp</SelectItem>
          {flowVariables.map((name) => (
            <SelectItem key={name} value={name}>
              {`{{vars.${name}}}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">O nome identifica o ganhador no sorteio. Só é perguntado a quem ainda não está inscrito.</p>
    </div>
  );
}

export function PromoEnrollForm({ data, onChange }: FormProps) {
  return (
    <div className="space-y-4">
      <CampaignStatus />
      <p className="text-xs text-muted-foreground">
        Pede o nome, envia o resumo e o link do regulamento com &quot;Aceito / Não aceito&quot; e registra o aceite no lead. Quem já
        é inscrito sai direto por &quot;Já inscrito&quot;.
      </p>
      <NameSourceField data={data} onChange={onChange} />
      <ReplyDeadlineField value={data.replyTimeoutMinutes} onChange={(replyTimeoutMinutes) => onChange({ ...data, replyTimeoutMinutes })} />
    </div>
  );
}

export function PromoReceiptForm({ data, onChange }: FormProps) {
  const config = parsePromoReceipt(data);
  return (
    <div className="space-y-4">
      <CampaignStatus />
      <div className="space-y-1.5">
        <Label>Foto do cupom</Label>
        <VariableSelect value={config.photoVariable} emptyLabel="Última foto que o cliente mandou" onChange={(photoVariable) => onChange({ ...data, photoVariable })} />
        <p className="text-xs text-muted-foreground">
          Uma Pergunta do tipo &quot;Foto ou arquivo&quot; antes deste bloco. As fotos mandadas junto também são cadastradas.
        </p>
      </div>
      <label className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-medium">Responder com a mensagem da promoção</span>
          <span className="block text-xs text-muted-foreground">
            Números da sorte, cupom repetido, foto ilegível... Desligado, nada é enviado e você escreve a mensagem em cada saída.
          </span>
        </span>
        <Switch checked={config.sendDefaultReply} onCheckedChange={(sendDefaultReply) => onChange({ ...data, sendDefaultReply })} />
      </label>
      <VariablesHint names={PROMO_RECEIPT_VARIABLES} />
      <p className="text-xs text-muted-foreground">A IA só lê o cupom; quem decide se vale e quantos números rende são as regras da campanha. Cada leitura cobra Stars.</p>
    </div>
  );
}

export function PromoLookupForm({ data, onChange }: FormProps) {
  const config = parsePromoLookup(data);
  return (
    <div className="space-y-4">
      <CampaignStatus />
      <label className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-medium">Pedir o celular antes</span>
          <span className="block text-xs text-muted-foreground">Confere se quem pergunta é o dono do cadastro, como na promoção de sempre.</span>
        </span>
        <Switch checked={config.askPhone} onCheckedChange={(askPhone) => onChange({ ...data, askPhone })} />
      </label>
      {config.askPhone && <ReplyDeadlineField value={data.replyTimeoutMinutes} onChange={(replyTimeoutMinutes) => onChange({ ...data, replyTimeoutMinutes })} />}
      <VariablesHint names={PROMO_LOOKUP_VARIABLES} />
    </div>
  );
}
