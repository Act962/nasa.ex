"use client";

import { useState, useMemo } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  LinkIcon,
  PlusIcon,
  SearchIcon,
  Share2Icon,
  TrashIcon,
  XIcon,
  LayoutDashboardIcon,
  PackageIcon,
  FileTextIcon,
  FileSignatureIcon,
  CheckCircle2Icon,
  ClockIcon,
  TrendingUpIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  useForgeProducts,
  useForgeProposals,
  useCreateForgeProposal,
  useDeleteForgeProposal,
  useForgeDashboard,
} from "@/features/forge/hooks/use-forge";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "painel" | "produtos" | "propostas" | "contratos";

interface CartItem {
  productId: string;
  name: string;
  unit: string;
  quantity: string;
  unitValue: string;
}

interface ForgePanelProps {
  onClose: () => void;
  onInsertLink: (text: string) => void;
  leadId?: string;
  leadName?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBRL(value: string | number | null | undefined) {
  const num = Number(value ?? 0);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function proposalTotal(products: CartItem[]) {
  return products.reduce(
    (sum, p) => sum + Number(p.unitValue) * Number(p.quantity),
    0,
  );
}

// ─── Create Proposal View ────────────────────────────────────────────────────

function CreateProposalView({
  leadId,
  leadName,
  onBack,
  onCreated,
}: {
  leadId?: string;
  leadName?: string;
  onBack: () => void;
  onCreated: (token: string, number: number, title: string) => void;
}) {
  const { data: session } = authClient.useSession();
  const [title, setTitle] = useState(
    leadName ? `Proposta para ${leadName}` : "",
  );
  const [validUntil, setValidUntil] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  const { data: productsData, isLoading: loadingProducts } =
    useForgeProducts(search);
  const products = productsData?.products ?? [];

  const createProposal = useCreateForgeProposal();

  function addToCart(p: {
    id: string;
    name: string;
    unit: string;
    value: string;
  }) {
    setCart((prev) => {
      const exists = prev.find((c) => c.productId === p.id);
      if (exists) {
        return prev.map((c) =>
          c.productId === p.id
            ? { ...c, quantity: String(Number(c.quantity) + 1) }
            : c,
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          unit: p.unit,
          quantity: "1",
          unitValue: p.value,
        },
      ];
    });
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  }

  function updateQty(productId: string, qty: string) {
    setCart((prev) =>
      prev.map((c) => (c.productId === productId ? { ...c, quantity: qty } : c)),
    );
  }

  async function handleCreate() {
    if (!title.trim()) return toast.error("Informe o título da proposta");
    if (!session?.user.id) return toast.error("Usuário não autenticado");

    createProposal.mutate(
      {
        title,
        clientId: leadId,
        responsibleId: session.user.id,
        validUntil: validUntil || undefined,
        description: description || undefined,
        products: cart.map((c, i) => ({
          productId: c.productId,
          quantity: c.quantity,
          unitValue: c.unitValue,
          order: i,
        })),
      },
      {
        onSuccess: (data) => {
          onCreated("", data.proposal.number, title);
        },
      },
    );
  }

  const total = proposalTotal(cart);

  return (
    <div className="flex flex-col gap-3 px-4 py-3 overflow-y-auto flex-1">
      {/* Title */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Título *
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Proposta de Marketing Digital"
          className="h-8 text-sm"
        />
      </div>

      {/* Valid until */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Válida até
        </label>
        <Input
          type="date"
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Descrição
        </label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detalhes da proposta..."
          className="text-sm resize-none min-h-[60px]"
        />
      </div>

      {/* Product search */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Adicionar produtos
        </label>
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar produto..."
            className="pl-8 h-8 text-sm"
          />
        </div>
        {loadingProducts && (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        )}
        <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() =>
                addToCart({
                  id: p.id,
                  name: p.name,
                  unit: p.unit,
                  value: p.value,
                })
              }
              className="flex items-center justify-between text-left px-2 py-1.5 rounded hover:bg-muted/60 transition-colors text-sm border"
            >
              <span className="truncate">{p.name}</span>
              <span className="text-xs text-muted-foreground ml-2 shrink-0">
                {formatBRL(p.value)}/{p.unit}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      {cart.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Itens selecionados
          </label>
          {cart.map((c) => (
            <div
              key={c.productId}
              className="flex items-center gap-2 text-sm bg-muted/40 rounded px-2 py-1"
            >
              <span className="flex-1 truncate">{c.name}</span>
              <Input
                type="number"
                min="1"
                value={c.quantity}
                onChange={(e) => updateQty(c.productId, e.target.value)}
                className="w-14 h-6 text-xs text-center p-1"
              />
              <span className="text-xs text-muted-foreground">{c.unit}</span>
              <button
                onClick={() => removeFromCart(c.productId)}
                className="text-destructive hover:text-destructive/80"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          ))}
          <div className="text-xs font-semibold text-right pt-1">
            Total: {formatBRL(total)}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onBack}
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={handleCreate}
          disabled={createProposal.isPending || !title.trim()}
        >
          {createProposal.isPending ? "Criando..." : "Criar proposta"}
        </Button>
      </div>
    </div>
  );
}

// ─── Proposals Tab ───────────────────────────────────────────────────────────

function ProposalsTab({
  onInsertLink,
}: {
  onInsertLink: (text: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data, isLoading } = useForgeProposals();
  const deleteProposal = useDeleteForgeProposal();

  const proposals = useMemo(() => {
    const list = data?.proposals ?? [];
    if (!search.trim()) return list;
    return list.filter((p) =>
      p.title.toLowerCase().includes(search.toLowerCase()),
    );
  }, [data, search]);

  function handleShare(token: string, number: number, title: string) {
    const url = `${window.location.origin}/proposta/${token}`;
    const text = `Link Proposta #${String(number).padStart(4, "0")} - ${title} ${url}`;
    onInsertLink(text);
    toast.success("Link inserido na mensagem!");
  }

  function handleCopy(token: string) {
    const url = `${window.location.origin}/proposta/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  }

  function handleView(token: string) {
    window.open(`/proposta/${token}`, "_blank");
  }

  return (
    <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-hidden">
      <div className="px-3 pt-2 shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar propostas"
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Lista com scroll fixo */}
      <div className="overflow-y-auto px-3 pb-3 flex flex-col gap-1.5" style={{ maxHeight: 340 }}>
        {isLoading && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Carregando...
          </p>
        )}
        {!isLoading && proposals.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhuma proposta encontrada
          </p>
        )}
        {proposals.map((p) => {
          const total = p.products.reduce(
            (sum, pp) => sum + Number(pp.unitValue) * Number(pp.quantity),
            0,
          );
          const isExpanded = expandedId === p.id;
          return (
            <div key={p.id} className="rounded-lg border bg-card overflow-hidden">
              {/* Header do card — sempre visível */}
              <div className="flex items-center gap-1 px-3 py-2.5">
                <button
                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                >
                  {isExpanded ? (
                    <ChevronDownIcon className="size-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRightIcon className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm font-medium truncate">
                    Proposta #{String(p.number).padStart(4, "0")} - {p.title}
                  </span>
                </button>

                {/* Botão enviar link sempre visível */}
                <Button
                  size="sm"
                  className="h-7 text-xs shrink-0 gap-1 ml-1"
                  title="Enviar link no chat"
                  onClick={() => handleShare(p.publicToken, p.number, p.title)}
                >
                  <Share2Icon className="size-3" />
                  Enviar link
                </Button>
              </div>

              {/* Detalhes expandidos */}
              {isExpanded && (
                <div className="px-3 pb-3 flex flex-col gap-2 border-t">
                  <p className="text-base font-bold text-primary pt-2">
                    {formatBRL(total)}
                  </p>
                  {p.responsible && (
                    <p className="text-xs text-muted-foreground">
                      👤 Responsável: {p.responsible.name}
                    </p>
                  )}
                  {p.validUntil && (
                    <p className="text-xs text-muted-foreground">
                      📅 Válida até{" "}
                      {new Date(p.validUntil).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      title="Visualizar"
                      onClick={() => handleView(p.publicToken)}
                    >
                      <EyeIcon className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      title="Copiar link"
                      onClick={() => handleCopy(p.publicToken)}
                    >
                      <LinkIcon className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => deleteProposal.mutate({ id: p.id })}
                      disabled={deleteProposal.isPending}
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Products Tab ────────────────────────────────────────────────────────────

function ProductsTab() {
  const [search, setSearch] = useState("");
  const { data: productsRes, isLoading } = useForgeProducts(search);
  const products = productsRes?.products ?? [];

  return (
    <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-hidden">
      <div className="px-3 pt-2 shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar produto"
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-1.5">
        {isLoading && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Carregando...
          </p>
        )}
        {!isLoading && products.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum produto cadastrado
          </p>
        )}
        {products.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between border rounded-lg px-3 py-2 bg-card"
          >
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{p.name}</span>
              <span className="text-xs text-muted-foreground">
                SKU: {p.sku} · {p.unit}
              </span>
            </div>
            <span className="text-sm font-semibold text-primary shrink-0 ml-2">
              {formatBRL(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard Tab ───────────────────────────────────────────────────────────

function DashboardTab() {
  const { data, isLoading } = useForgeDashboard();

  if (isLoading)
    return (
      <p className="text-xs text-muted-foreground text-center py-6">
        Carregando...
      </p>
    );

  const kpis = [
    {
      icon: FileTextIcon,
      label: "Propostas enviadas",
      value: data?.proposalsSent ?? 0,
    },
    {
      icon: CheckCircle2Icon,
      label: "Pagas",
      value: data?.proposalsPaid ?? 0,
      color: "text-green-500",
    },
    {
      icon: ClockIcon,
      label: "Expiradas",
      value: data?.proposalsExpired ?? 0,
      color: "text-yellow-500",
    },
    {
      icon: TrendingUpIcon,
      label: "Valor total",
      value: formatBRL(data?.totalProposalValue ?? 0),
    },
  ];

  return (
    <div className="flex flex-col gap-2 px-3 py-3 flex-1 overflow-y-auto">
      <div className="grid grid-cols-2 gap-2">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="border rounded-lg px-3 py-2 bg-card flex flex-col gap-0.5"
          >
            <k.icon
              className={cn("size-4 text-muted-foreground", k.color)}
            />
            <p className="text-sm font-semibold">{k.value}</p>
            <p className="text-xs text-muted-foreground leading-tight">
              {k.label}
            </p>
          </div>
        ))}
      </div>

      {(data?.recentProposals?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-1 mt-1">
          <p className="text-xs font-medium text-muted-foreground">
            Recentes
          </p>
          {data!.recentProposals.slice(0, 5).map((p: any) => (
            <div
              key={p.id}
              className="flex items-center justify-between text-xs border rounded px-2 py-1.5 bg-card"
            >
              <span className="truncate">
                #{String(p.number).padStart(4, "0")} {p.title}
              </span>
              <span
                className={cn(
                  "ml-2 shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium",
                  p.status === "PAGA"
                    ? "bg-green-500/20 text-green-600"
                    : p.status === "ENVIADA"
                      ? "bg-blue-500/20 text-blue-600"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {p.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ForgePanel({
  onClose,
  onInsertLink,
  leadId,
  leadName,
}: ForgePanelProps) {
  const [tab, setTab] = useState<Tab>("propostas");
  const [creating, setCreating] = useState(false);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "painel", label: "Painel", icon: LayoutDashboardIcon },
    { id: "produtos", label: "Produtos", icon: PackageIcon },
    { id: "propostas", label: "Propostas", icon: FileTextIcon },
    { id: "contratos", label: "Contratos", icon: FileSignatureIcon },
  ];

  function handleProposalCreated(
    _token: string,
    number: number,
    title: string,
  ) {
    setCreating(false);
    setTab("propostas");
    toast.success(
      `Proposta #${String(number).padStart(4, "0")} criada! Acesse em Propostas para enviar o link.`,
    );
  }

  return (
    <div className="absolute bottom-full left-0 mb-2 w-[360px] bg-popover border rounded-xl shadow-lg z-50 flex flex-col overflow-hidden max-h-[520px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          {creating && (
            <button
              onClick={() => setCreating(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRightIcon className="size-4 rotate-180" />
            </button>
          )}
          <span className="text-sm font-semibold">
            {creating ? "Nova Proposta" : "Forge"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!creating && (
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setCreating(true)}
            >
              <PlusIcon className="size-3" />
              Criar Proposta para Lead
            </Button>
          )}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>

      {creating ? (
        <CreateProposalView
          leadId={leadId}
          leadName={leadName}
          onBack={() => setCreating(false)}
          onCreated={handleProposalCreated}
        />
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b shrink-0">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors border-b-2",
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="size-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {tab === "painel" && <DashboardTab />}
            {tab === "produtos" && <ProductsTab />}
            {tab === "propostas" && (
              <ProposalsTab onInsertLink={onInsertLink} />
            )}
            {tab === "contratos" && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-muted-foreground">
                  Contratos disponíveis no módulo Forge completo
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
