import { EventEnterClient } from "@/features/world-events/components/event-enter-client";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}

/**
 * Entrada no WorldEvent — valida accessToken e abre o mapa.
 *
 * MVP: redeem do ticket + tela de "entrando" → mensagem com instruções
 * (Phaser integration completa entra na próxima PR).
 */
export default async function EventEnterPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { token } = await searchParams;
  return <EventEnterClient slug={slug} token={token ?? null} />;
}
