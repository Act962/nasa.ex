"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Loader2,
  Megaphone,
  Plug,
  Power,
  Receipt,
  ShoppingCart,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDisconnectNerp } from "@/features/nerp/hooks/use-nerp-connection";
import { useNerpCatalogIntegration } from "../../hooks/use-nerp-catalog-integration";
import { useCheckPermission } from "@/hooks/use-check-permission";
import { CatalogOnlineSettingsForm } from "./catalog-online-settings-form";

const CONNECT_URL = `/api/integrations/nerp/start?returnUrl=${encodeURIComponent("/integrations/nerp")}`;

type NerpApp = {
  key: string;
  name: string;
  description: string;
  icon: LucideIcon;
  scope: string;
  href: string;
};

const NERP_APPS: NerpApp[] = [
  {
    key: "catalogo-online",
    name: "Catálogo online",
    description: "Pedidos do catálogo viram leads; o Astro negocia, cobra via PIX e manda para a entrega.",
    icon: ShoppingCart,
    scope: "catalog-orders:push",
    href: "#catalogo-online",
  },
  {
    key: "erp",
    name: "ERP · Vendas",
    description: "Vendas, pedidos e dashboard do NERP dentro do Órbita.",
    icon: Receipt,
    scope: "sales:rw",
    href: "/nerp/sales",
  },
  {
    key: "estoque",
    name: "Produtos e estoque",
    description: "Catálogo de produtos, categorias e saldo de estoque.",
    icon: Boxes,
    scope: "stocks:rw",
    href: "/nerp/products",
  },
  {
    key: "clientes",
    name: "Clientes",
    description: "Base de clientes do NERP sincronizada com os leads.",
    icon: Users,
    scope: "customer:rw",
    href: "/nerp/customer",
  },
  {
    key: "financeiro",
    name: "Financeiro",
    description: "Pagamentos confirmados no Órbita entram como venda confirmada no NERP.",
    icon: Wallet,
    scope: "sales:rw",
    href: "/nerp/dashboard",
  },
  {
    key: "catalogo-promocional",
    name: "Catálogo promocional",
    description: "Configurações e vitrine do catálogo da loja.",
    icon: Megaphone,
    scope: "catalog-settings:rw",
    href: "/nerp/catalog-settings",
  },
];

const FLOW_STEPS = [
  "Cliente fecha o carrinho em /catalogo/<sua-loja> no NERP.",
  "O pedido chega como lead no tracking escolhido, com a lista de itens na conversa.",
  "O Astro confirma itens, entrega, CPF e forma de pagamento.",
  "PIX (ou link de cartão/boleto) é gerado na sua conta Asaas e enviado ao cliente.",
  "Pagamento confirmado → lead vai para o tracking de logística e a venda é confirmada no NERP.",
  "O cliente acompanha tudo e fala com o time pela página do pedido — ou continua no WhatsApp.",
];

export function NerpIntegrationHub() {
  const searchParams = useSearchParams();
  const integration = useNerpCatalogIntegration();
  const disconnect = useDisconnectNerp();
  const { checkPermission, isLoading: isLoadingPermissions } = useCheckPermission();
  const canViewCatalog = checkPermission("catalogo-online", "canView");
  const canConfigureCatalog = checkPermission("catalogo-online", "canEdit");
  const canDisconnect = checkPermission("catalogo-online", "canDelete");
  const data = integration.data;
  const isConnected = !!data?.connection.isConnected;
  const hasError = searchParams.get("nerp_error");

  const handleDisconnect = () => {
    disconnect.mutate(
      {},
      {
        onSuccess: () => {
          toast.success("NERP desconectado");
          integration.refetch();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  if (!isLoadingPermissions && !canViewCatalog) {
    return (
      <p className="mx-auto max-w-5xl text-sm text-muted-foreground">
        Seu papel não tem acesso ao Catálogo online (NERP). O Master libera em Configurações → Permissões.
      </p>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Link
        href="/integrations"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Integrações
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Plug className="size-6" />
              </div>
              <div>
                <CardTitle className="text-xl">NERP · ERP e Catálogo online</CardTitle>
                <CardDescription>
                  Conecte a sua loja no NERP. Você entra no NERP (com Google ou e-mail), aprova o acesso e
                  as chaves entre as plataformas são trocadas automaticamente.
                </CardDescription>
              </div>
            </div>
            {integration.isLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : isConnected ? (
              <Badge className="gap-1">
                <CheckCircle2 className="size-3" /> Conectado
              </Badge>
            ) : (
              <Badge variant="outline">Desconectado</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {hasError && (
            <p className="text-sm text-destructive">
              Não foi possível concluir a conexão ({hasError}). Tente novamente.
            </p>
          )}
          {isConnected && !data?.connection.hasOrderScope && (
            <p className="text-sm text-amber-600">
              A conexão atual não autoriza o envio de pedidos do Catálogo online. Clique em
              &quot;Reconectar&quot; e aprove o novo acesso no NERP.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {canConfigureCatalog && (
              <Button asChild>
                <a href={CONNECT_URL}>{isConnected ? "Reconectar" : "Conectar"}</a>
              </Button>
            )}
            {isConnected && canDisconnect && (
              <Button variant="outline" onClick={handleDisconnect} disabled={disconnect.isPending}>
                {disconnect.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Power className="size-4" />
                )}
                Desconectar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Aplicações do NERP</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NERP_APPS.map((app) => {
            const isGranted = !!data?.connection.scopes.includes(app.scope);
            return (
              <Link key={app.key} href={app.href} className="group">
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardHeader className="gap-2">
                    <div className="flex items-center justify-between">
                      <app.icon className="size-5 text-primary" />
                      <Badge variant={isGranted ? "secondary" : "outline"}>
                        {isGranted ? "Liberado" : "Sem acesso"}
                      </Badge>
                    </div>
                    <CardTitle className="text-base">{app.name}</CardTitle>
                    <CardDescription>{app.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <Card id="catalogo-online">
        <CardHeader>
          <CardTitle>Catálogo online → Astro → Logística</CardTitle>
          <CardDescription>
            {data?.openOrders
              ? `${data.openOrders} pedido(s) em andamento agora.`
              : "Configure para onde vão os pedidos e a conta Asaas que recebe os pagamentos."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ol className="flex flex-col gap-2 text-sm text-muted-foreground">
            {FLOW_STEPS.map((step, index) => (
              <li key={step} className="flex gap-2">
                <span className="font-semibold text-foreground">{index + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
          {integration.isLoading || !data ? (
            <Skeleton className="h-64 w-full" />
          ) : !isConnected ? (
            <p className="text-sm text-muted-foreground">Conecte o NERP para configurar o Catálogo online.</p>
          ) : (
            <CatalogOnlineSettingsForm
              trackings={data.trackings}
              settings={data.settings}
              webhookUrl={data.webhookUrl}
              canEdit={canConfigureCatalog}
            />
          )}
          <p className="text-xs text-muted-foreground">
            No NERP, em Catálogo online → Configurações → Modo de operação, escolha &quot;Órbita&quot; para os
            pedidos passarem a vir para cá.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
