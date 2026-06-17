import { permanentRedirect } from "next/navigation";

/**
 * Rota obsoleta — `/station/[nick]` foi removida do fluxo. O acesso ao
 * World agora vai direto via `/station/[nick]/world`, e o card de entrada
 * vive no perfil público (`/space/[nick]`).
 *
 * Mantemos a rota apenas pra fazer redirect 301 e não quebrar links
 * antigos (emails, prints, bookmarks). Quem chega aqui é mandado pro
 * perfil público da station, onde encontra o botão "Entrar na Space
 * Station" que abre o World.
 */
interface Props {
  params: Promise<{ nick: string }>;
}

export default async function ObsoleteStationRoute({ params }: Props) {
  const { nick } = await params;
  permanentRedirect(`/space/${nick}`);
}
