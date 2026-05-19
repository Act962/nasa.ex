"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { client } from "@/lib/orpc";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  Users,
  Sparkles,
  CheckCircle2,
  Ticket,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EventData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  currentOccupancy: number;
  ticketPriceStars: number | null;
  ticketPriceBrl: number | null;
  isFree: boolean;
  status: string;
  stationNick: string | null;
  stationBio: string | null;
  stationAvatarUrl: string | null;
  stationBannerUrl: string | null;
}

/**
 * Landing page pública de um WorldEvent.
 *
 * Comportamento por estado:
 *   - Não logado → CTA "Fazer login pra comprar".
 *   - Logado + sem ingresso → mostra opções (STARs / BRL / free).
 *   - Logado + com ingresso ACTIVE → CTA "Entrar no evento".
 *   - Evento ENDED/CANCELLED → estado encerrado.
 */
export function EventPublicPage({ event }: { event: EventData }) {
  const { data: session } = authClient.useSession();
  const isLoggedIn = !!session?.user;

  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [resultToken, setResultToken] = useState<string | null>(null);

  const purchaseMut = useMutation({
    mutationFn: async (paymentMethod: "stars" | "stripe" | "free") => {
      return client.worldEvents.purchaseTicket({
        eventId: event.id,
        paymentMethod,
      });
    },
    onSuccess: (res) => {
      setPurchaseError(null);
      if (res.accessToken) {
        setResultToken(res.accessToken);
      } else if (res.stripeCheckoutHint) {
        // Stripe Checkout: implementado em PR futura (mocked agora).
        setPurchaseError(
          "Checkout via Stripe ainda não disponível. Use STARs ou aguarde.",
        );
      }
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Erro ao comprar.";
      setPurchaseError(msg);
    },
  });

  const isEnded = event.status === "ENDED" || event.status === "CANCELLED";
  const isUpcoming = new Date(event.startsAt).getTime() > Date.now();

  const enterHref = resultToken
    ? `/eventos/${event.slug}/enter?token=${resultToken}`
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100">
      {/* Hero / cover */}
      <div className="relative h-72 sm:h-96 overflow-hidden bg-zinc-800">
        {event.coverUrl && (
          <Image
            src={event.coverUrl}
            alt={event.title}
            fill
            className="object-cover"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 max-w-3xl">
          <div className="flex items-center gap-2 text-xs text-violet-300 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            NASA World · Evento {event.isFree ? "Gratuito" : ""}
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            {event.title}
          </h1>
          {event.stationNick && (
            <p className="mt-2 text-sm text-zinc-400">
              Organizado por{" "}
              <Link
                href={`/@${event.stationNick}`}
                className="text-violet-300 hover:underline"
              >
                @{event.stationNick}
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Quick info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <InfoRow icon={Calendar} label="Início">
            {format(new Date(event.startsAt), "dd MMM yyyy 'às' HH:mm", {
              locale: ptBR,
            })}
          </InfoRow>
          <InfoRow icon={Clock} label="Duração">
            até{" "}
            {format(new Date(event.endsAt), "dd MMM, HH:mm", { locale: ptBR })}
          </InfoRow>
          <InfoRow icon={Users} label="Capacidade">
            {event.currentOccupancy} / {event.capacity}
          </InfoRow>
        </div>

        {/* Description */}
        {event.description && (
          <div className="prose prose-invert prose-zinc max-w-none whitespace-pre-wrap">
            {event.description}
          </div>
        )}

        {/* Status badges */}
        {isEnded && (
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 px-4 py-3 text-sm text-zinc-400">
            Esse evento já {event.status === "CANCELLED" ? "foi cancelado" : "terminou"}.
          </div>
        )}
        {!isEnded && isUpcoming && (
          <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
            Começa{" "}
            {formatDistanceToNow(new Date(event.startsAt), {
              locale: ptBR,
              addSuffix: true,
            })}
            .
          </div>
        )}

        {/* CTA box */}
        {!isEnded && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-base font-semibold">Garanta seu ingresso</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {event.isFree
                    ? "Acesso gratuito."
                    : event.ticketPriceStars && event.ticketPriceBrl
                      ? `Pague em STARs ou em R$.`
                      : event.ticketPriceStars
                        ? `Pagamento em STARs.`
                        : `Pagamento em R$.`}
                </p>
              </div>
              <div className="text-right">
                {event.ticketPriceBrl && !event.isFree && (
                  <div className="text-2xl font-bold tabular-nums">
                    R$ {event.ticketPriceBrl.toFixed(2)}
                  </div>
                )}
                {event.ticketPriceStars && !event.isFree && (
                  <div className="text-sm text-zinc-400 tabular-nums">
                    ou {event.ticketPriceStars.toLocaleString("pt-BR")} ★
                  </div>
                )}
              </div>
            </div>

            {resultToken && enterHref ? (
              <Link
                href={enterHref}
                className="inline-flex items-center gap-2 w-full justify-center bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-3 rounded-lg transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Ingresso confirmado · Entrar no evento
              </Link>
            ) : !isLoggedIn ? (
              <Link
                href={`/sign-in?next=/eventos/${event.slug}`}
                className="inline-flex items-center gap-2 w-full justify-center bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-3 rounded-lg transition-colors"
              >
                <Ticket className="w-4 h-4" />
                Fazer login pra continuar
              </Link>
            ) : (
              <div className="flex flex-col gap-2">
                {event.isFree && (
                  <Button
                    onClick={() => purchaseMut.mutate("free")}
                    disabled={purchaseMut.isPending}
                    className="w-full bg-violet-600 hover:bg-violet-700"
                  >
                    {purchaseMut.isPending
                      ? "Gerando ingresso…"
                      : "Garantir ingresso grátis"}
                  </Button>
                )}
                {!event.isFree && event.ticketPriceStars && (
                  <Button
                    onClick={() => purchaseMut.mutate("stars")}
                    disabled={purchaseMut.isPending}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-900"
                  >
                    Comprar por {event.ticketPriceStars.toLocaleString("pt-BR")}{" "}
                    ★
                  </Button>
                )}
                {!event.isFree && event.ticketPriceBrl && (
                  <Button
                    onClick={() => purchaseMut.mutate("stripe")}
                    disabled={purchaseMut.isPending}
                    variant="outline"
                    className="w-full"
                  >
                    Comprar por R$ {event.ticketPriceBrl.toFixed(2)}
                  </Button>
                )}
              </div>
            )}

            {purchaseError && (
              <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {purchaseError}
              </div>
            )}
          </div>
        )}

        {/* Footer info */}
        <div className="pt-6 border-t border-zinc-800 text-xs text-zinc-500 space-y-1">
          <p>
            Ao entrar no evento, você concorda com os termos do NASA World.
          </p>
          {event.stationNick && (
            <p>
              Sobre o organizador: visite{" "}
              <Link
                href={`/@${event.stationNick}`}
                className="text-zinc-300 hover:underline"
              >
                @{event.stationNick}
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Calendar;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 uppercase tracking-wider">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-zinc-100">{children}</div>
    </div>
  );
}
