"use client";

import Link from "next/link";
import { SpaceCard } from "../space-card";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";

interface CardSpaceStationProps {
  nick: string;
  isViewerAuthenticated: boolean;
  isViewerMember: boolean;
}

/**
 * Porta para /station/[nick]/world (World 2D) com gating (§7.4).
 * - Não logado ⇒ "Fazer login para entrar"
 * - Logado + membro ⇒ "Entrar na Space Station"
 * - Logado + não-membro ⇒ "Solicitar acesso" (cria StationAccessRequest)
 *
 * A página intermediária /station/[nick] foi removida — botão vai direto pro World.
 */
export function CardSpaceStation({
  nick,
  isViewerAuthenticated,
  isViewerMember,
}: CardSpaceStationProps) {
  return (
    <SpaceCard
      title="Space Station"
      subtitle="Ambiente interno 3D da empresa"
    >
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-purple-500">
            <Rocket className="size-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              Descubra a Space Station
            </p>
            <p className="max-w-md text-xs text-white/60">
              Mergulhe no universo 3D da empresa — mapa, pessoas, chats
              internos. Acesso controlado por permissão.
            </p>
          </div>
        </div>

        {!isViewerAuthenticated ? (
          <Button
            asChild
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Link href={`/sign-in?callbackUrl=/space/${nick}`}>
              Fazer login para entrar
            </Link>
          </Button>
        ) : isViewerMember ? (
          <Button
            asChild
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Link href={`/station/${nick}/world`}>Entrar na Space Station</Link>
          </Button>
        ) : (
          <Button
            variant="outline"
            className="border-orange-500/40 text-orange-300 hover:bg-orange-500/10"
          >
            Solicitar acesso
          </Button>
        )}
      </div>
    </SpaceCard>
  );
}
