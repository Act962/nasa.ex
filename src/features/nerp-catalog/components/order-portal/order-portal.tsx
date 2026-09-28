"use client";

import { Loader2, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCatalogOrderPortal } from "../../hooks/use-catalog-order-portal";
import { formatBrl } from "../../utils/format-order";
import { OrderStatusTimeline } from "./order-status-timeline";
import { OrderPaymentCard } from "./order-payment-card";
import { OrderChat } from "./order-chat";
import { OrderStarFriendsCard } from "./order-star-friends-card";

export function OrderPortal({ token }: { token: string }) {
  const orderQuery = useCatalogOrderPortal(token);
  const order = orderQuery.data;

  if (orderQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">
        Pedido não encontrado. Confira o link recebido.
      </div>
    );
  }

  const isAwaitingPayment = order.status === "AWAITING_PAYMENT";

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 p-4 md:p-8">
      <header className="flex items-center gap-3">
        <Avatar className="size-12">
          {order.store.logo && <AvatarImage src={order.store.logo} alt={order.store.name} />}
          <AvatarFallback>{order.store.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{order.store.name}</h1>
          <p className="text-sm text-muted-foreground">
            Pedido #{order.saleNumber} · código {order.code}
          </p>
        </div>
        {order.whatsappUrl && (
          <Button variant="outline" asChild>
            <a href={order.whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" /> Continuar no WhatsApp
            </a>
          </Button>
        )}
      </header>

      <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Andamento</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderStatusTimeline status={order.status} logisticsStage={order.logisticsStage} />
            </CardContent>
          </Card>

          {isAwaitingPayment && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pagamento · {formatBrl(order.total)}</CardTitle>
              </CardHeader>
              <CardContent>
                <OrderPaymentCard payment={order.payment} />
              </CardContent>
            </Card>
          )}

          <OrderStarFriendsCard token={token} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Itens</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {order.items.map((item) => (
                <div key={`${item.name}-${item.unitPrice}`} className="flex items-center gap-3 text-sm">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- imagem vem do bucket do NERP
                    <img src={item.imageUrl} alt={item.name} className="size-10 rounded-md object-cover" />
                  ) : (
                    <div className="size-10 rounded-md bg-muted" />
                  )}
                  <span className="flex-1">
                    {item.quantity}x {item.name}
                  </span>
                  <span className="font-medium">{formatBrl(item.total)}</span>
                </div>
              ))}
              <div className="flex flex-col gap-1 border-t pt-3 text-sm">
                {order.shipping > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Frete</span>
                    <span>{formatBrl(order.shipping)}</span>
                  </div>
                )}
                {order.discount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Desconto</span>
                    <span>-{formatBrl(order.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatBrl(order.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden py-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="text-base">Fale com a loja</CardTitle>
          </CardHeader>
          <OrderChat token={token} storeName={order.store.name} />
        </Card>
      </div>
    </main>
  );
}
