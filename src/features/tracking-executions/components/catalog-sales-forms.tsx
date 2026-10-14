"use client";

// Formulários das ações da venda guiada pelo catálogo (spec 0104, D-5).
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FormProps = {
  data: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
};

export const CATALOG_SALES_NODE_TYPES = new Set([
  "SALES_APPROVAL",
  "CHECK_CREDIT",
  "FIND_CUSTOMER_BY_DOCUMENT",
  "ROUTE_TO_CONSULTANT",
  "CATALOG_ORDER_ACTION",
]);

const SECTOR_OPTIONS = [
  { value: "COMMERCIAL", label: "Comercial (preço e estoque)" },
  { value: "FINANCE", label: "Financeiro (crédito e pagamento)" },
  { value: "LOGISTICS", label: "Logística (prazo de entrega)" },
  { value: "ACCOUNTING", label: "Contábil (fiscal)" },
];

const ORDER_VARIABLES = [
  { path: "vars.pedido.numero", description: "número do pedido" },
  { path: "vars.pedido.cliente", description: "primeiro nome do cliente" },
  { path: "vars.pedido.total", description: "total aprovado (R$)" },
  { path: "vars.pedido.entrega", description: "previsão de entrega" },
  { path: "vars.pedido.pontos", description: "frase dos pontos da compra" },
  { path: "vars.pedido.link", description: "link do acompanhamento" },
  { path: "vars.pedido.codigo", description: "código do link (botão de link do template)" },
  { path: "vars.pedido.prazoMudou", description: '"sim" quando a 2ª rodada mudou o prazo' },
  { path: "vars.pedido.motivos", description: "motivos de recusa ou ajuste" },
];

function asText(value: unknown, fallback = ""): string {
  return value == null ? fallback : String(value);
}

function Hint({ text }: { text: string }) {
  return <p className="mb-2 text-xs italic leading-snug text-muted-foreground">{text}</p>;
}

function VariablesHelp() {
  return (
    <div className="space-y-1 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">Use nas próximas ações</p>
      {ORDER_VARIABLES.map((variable) => (
        <p key={variable.path}>
          <code>{`{{${variable.path}}}`}</code> — {variable.description}
        </p>
      ))}
    </div>
  );
}

function QuestionField({ data, onChange }: FormProps) {
  return (
    <div className="space-y-2">
      <Label>Pergunta ao cliente</Label>
      <Textarea rows={2} value={asText(data.question)} onChange={(event) => onChange({ ...data, question: event.target.value })} />
      <p className="text-xs text-muted-foreground">
        A ação pergunta, espera a resposta (o Astro não responde por cima) e decide. Em branco, lê a mensagem que disparou o fluxo.
      </p>
    </div>
  );
}

function SalesApprovalForm({ data, onChange }: FormProps) {
  const sectors = Array.isArray(data.sectors) ? (data.sectors as string[]) : [];
  const timeoutHours = Math.round((typeof data.timeoutMinutes === "number" ? data.timeoutMinutes : 2880) / 60);
  return (
    <div className="space-y-4">
      <Hint text="Envia o pedido a quem aprova por setor (cadastro em Catálogo online → Aprovadores) pelo WhatsApp oficial e espera. Saídas: aprovado, recusado (volta ao consultor) ou sem resposta." />
      <div className="space-y-2">
        <Label>Quando</Label>
        <Select value={asText(data.round, "PRE_PAYMENT")} onValueChange={(round) => onChange({ ...data, round })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PRE_PAYMENT">Antes do valor ir ao cliente</SelectItem>
            <SelectItem value="POST_PAYMENT">Depois do pagamento (conferência)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Setores que aprovam</Label>
        <p className="text-xs text-muted-foreground">Setor sem aprovador cadastrado fica de fora.</p>
        {SECTOR_OPTIONS.map((option) => {
          const checkboxId = `sales-sector-${option.value}`;
          return (
            <div key={option.value} className="flex items-center gap-2">
              <Checkbox
                id={checkboxId}
                checked={sectors.includes(option.value)}
                onCheckedChange={(checked) =>
                  onChange({
                    ...data,
                    sectors: checked === true ? [...sectors.filter((sector) => sector !== option.value), option.value] : sectors.filter((sector) => sector !== option.value),
                  })
                }
              />
              <Label htmlFor={checkboxId} className="text-sm font-normal">
                {option.label}
              </Label>
            </div>
          );
        })}
      </div>
      <div className="space-y-2">
        <Label>Desistir depois de (horas)</Label>
        <Input
          type="number"
          min={1}
          value={timeoutHours}
          onChange={(event) => onChange({ ...data, timeoutMinutes: Math.max(1, Number(event.target.value) || 48) * 60 })}
        />
      </div>
      <VariablesHelp />
    </div>
  );
}

function CheckCreditForm() {
  return (
    <div className="space-y-4">
      <Hint text='Confere as contas a receber vencidas do lead no Financeiro. Aplica a tag "Apto a comprar" ou "Inadimplente". Não fala nada ao cliente.' />
      <div className="space-y-1 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        <p>
          <code>{"{{vars.credito.apto}}"}</code> — &quot;sim&quot; ou &quot;nao&quot;
        </p>
        <p>
          <code>{"{{vars.credito.totalVencido}}"}</code> — valor em atraso (só para a equipe)
        </p>
      </div>
    </div>
  );
}

function FindCustomerForm({ data, onChange }: FormProps) {
  const source = asText(data.source, "text");
  return (
    <div className="space-y-4">
      <Hint text='Lê o CPF ou CNPJ e procura compra anterior. Saídas: cliente recorrente, cliente novo ou "sem documento" (peça de novo). Grava o documento no lead e no pedido.' />
      <div className="space-y-2">
        <Label>De onde vem o documento</Label>
        <Select value={source} onValueChange={(nextSource) => onChange({ ...data, source: nextSource })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Da resposta do cliente</SelectItem>
            <SelectItem value="lead">Do cadastro do lead</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {source === "text" && <QuestionField data={data} onChange={onChange} />}
    </div>
  );
}

function RouteToConsultantForm({ data, onChange }: FormProps) {
  return (
    <div className="space-y-4">
      <Hint text="Procura o nome citado pelo cliente entre os consultores do funil (rodízio). Achou um só: vira responsável, recebe a tag &quot;Já atendido&quot; e a IA pausa." />
      <QuestionField data={data} onChange={onChange} />
    </div>
  );
}

function CatalogOrderActionForm({ data, onChange }: FormProps) {
  return (
    <div className="space-y-4">
      <Hint text="Carrega o pedido do catálogo do lead em variáveis e, se escolhido, registra a decisão do cliente." />
      <div className="space-y-2">
        <Label>O que fazer</Label>
        <Select value={asText(data.action, "load")} onValueChange={(action) => onChange({ ...data, action })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="load">Só carregar o pedido</SelectItem>
            <SelectItem value="approve_quote">Cliente aprovou o valor</SelectItem>
            <SelectItem value="approve_delivery_change">Cliente aceitou o novo prazo</SelectItem>
            <SelectItem value="release">Liberar o pedido para entrega</SelectItem>
            <SelectItem value="await_reply">Esperar a resposta do cliente (Astro calado)</SelectItem>
            <SelectItem value="remind_customer">Lembrar o cliente de enviar o pedido (uma vez)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <VariablesHelp />
    </div>
  );
}

export function CatalogSalesForm({ nodeType, data, onChange }: FormProps & { nodeType: string }) {
  if (nodeType === "SALES_APPROVAL") return <SalesApprovalForm data={data} onChange={onChange} />;
  if (nodeType === "CHECK_CREDIT") return <CheckCreditForm />;
  if (nodeType === "FIND_CUSTOMER_BY_DOCUMENT") return <FindCustomerForm data={data} onChange={onChange} />;
  if (nodeType === "ROUTE_TO_CONSULTANT") return <RouteToConsultantForm data={data} onChange={onChange} />;
  return <CatalogOrderActionForm data={data} onChange={onChange} />;
}
