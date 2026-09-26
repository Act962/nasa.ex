"use client";

import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StarCostBadge } from "@/features/stars";
import { useInstallStarFriends } from "../hooks/use-star-friends";
import { STAR_FRIENDS_APP_SLUG } from "../lib/constants";

const HOW_IT_WORKS = [
  "Cada compra paga no Catálogo online ou no Forge vira star para o cliente.",
  "Você monta a lista de troca: produtos, descontos ou prêmios, cada um com o seu custo em stars.",
  "O cliente troca pelo consultor, pelo chat, pelo Astro ou pela página do pedido.",
  "Tudo fica registrado: quem lançou ou liberou stars, quando e quais itens.",
];

export function InstallStarFriends({ canInstall }: { canInstall: boolean }) {
  const install = useInstallStarFriends();
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Sparkles className="size-6 text-amber-500" /> STAR FRIENDS
        </CardTitle>
        <CardDescription>Programa de fidelidade para os seus clientes.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ol className="flex flex-col gap-2 text-sm">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step} className="flex gap-2">
              <span className="font-semibold">{index + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
        <StarCostBadge appSlug={STAR_FRIENDS_APP_SLUG} showSetup />
        {!canInstall && (
          <p className="text-sm text-muted-foreground">
            Só quem tem permissão de &quot;Editar&quot; no STAR FRIENDS pode instalar. Fale com o Master.
          </p>
        )}
        <Button
          className="w-fit"
          disabled={install.isPending || !canInstall}
          onClick={() =>
            install.mutate(
              {},
              {
                onSuccess: () => toast.success("STAR FRIENDS instalado"),
                onError: (error) => toast.error(error.message),
              },
            )
          }
        >
          {install.isPending && <Loader2 className="size-4 animate-spin" />}
          Instalar STAR FRIENDS
        </Button>
      </CardContent>
    </Card>
  );
}
