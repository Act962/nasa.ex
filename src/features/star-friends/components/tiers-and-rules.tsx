"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TierPlanet } from "./tier-planet";
import { useStarFriendsOverview, useUpsertStarFriendsTiers } from "../hooks/use-star-friends";
import { RewardsManager } from "./rewards-manager";

type TiersDraft = {
  moonMinStars: string;
  galaxyMinStars: string;
  earthPerks: string;
  moonPerks: string;
  galaxyPerks: string;
};

type ProgramTiers = {
  moonMinStars: number;
  galaxyMinStars: number;
  earthPerks: string | null;
  moonPerks: string | null;
  galaxyPerks: string | null;
};

const toDraft = (program: ProgramTiers): TiersDraft => ({
  moonMinStars: String(program.moonMinStars),
  galaxyMinStars: String(program.galaxyMinStars),
  earthPerks: program.earthPerks ?? "",
  moonPerks: program.moonPerks ?? "",
  galaxyPerks: program.galaxyPerks ?? "",
});

/** Aba "Níveis e regras" do /star-friends (spec 0041, RF-5). */
export function TiersAndRules({ canEdit }: { canEdit: boolean }) {
  const overview = useStarFriendsOverview();
  const program = overview.data?.program;
  if (!program) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <TiersForm key={`${program.moonMinStars}-${program.galaxyMinStars}`} program={program} canEdit={canEdit} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regras &quot;comprou X, ganhou Y&quot;</CardTitle>
          <CardDescription>
            Cada compra paga vale {program.starsPerPurchase} ⭐. Ao completar o cartão, o cliente troca pelo portal e a loja
            aprova em Resgates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RewardsManager canEdit={canEdit} variant="rules" />
        </CardContent>
      </Card>
    </div>
  );
}

function TiersForm({ program, canEdit }: { program: ProgramTiers; canEdit: boolean }) {
  const upsertTiers = useUpsertStarFriendsTiers();
  const [draft, setDraft] = useState<TiersDraft>(() => toDraft(program));

  const save = () =>
    upsertTiers.mutate(
      {
        moonMinStars: Number(draft.moonMinStars),
        galaxyMinStars: Number(draft.galaxyMinStars),
        earthPerks: draft.earthPerks.trim() || null,
        moonPerks: draft.moonPerks.trim() || null,
        galaxyPerks: draft.galaxyPerks.trim() || null,
      },
      {
        onSuccess: () => toast.success("Níveis salvos"),
        onError: (error) => toast.error(error.message),
      },
    );

  const rows = [
    { tier: "EARTH" as const, label: "Terra", phase: "Fase 1 · todo cliente começa aqui", starsKey: null, perksKey: "earthPerks" as const },
    { tier: "MOON" as const, label: "Lua", phase: "Fase 2", starsKey: "moonMinStars" as const, perksKey: "moonPerks" as const },
    { tier: "GALAXY" as const, label: "Galaxy", phase: "Fase 3 · cliente premium", starsKey: "galaxyMinStars" as const, perksKey: "galaxyPerks" as const },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Níveis do cliente</CardTitle>
        <CardDescription>Contam as ⭐ ganhas na vida toda. Trocar prêmios não faz o cliente descer.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rows.map((row) => (
          <div key={row.tier} className="flex flex-col gap-2 border-b pb-4 last:border-0 last:pb-0">
            <div className="flex items-center gap-3">
              <TierPlanet tier={row.tier} size={32} />
              <div className="flex-1">
                <p className="text-sm font-semibold">{row.label}</p>
                <p className="text-xs text-muted-foreground">{row.phase}</p>
              </div>
              {row.starsKey ? (
                <div className="flex items-center gap-2">
                  <Label htmlFor={`tier-${row.tier}`} className="text-xs text-muted-foreground">
                    a partir de
                  </Label>
                  <Input
                    id={`tier-${row.tier}`}
                    type="number"
                    min={1}
                    className="w-20"
                    disabled={!canEdit}
                    value={draft[row.starsKey]}
                    onChange={(event) => setDraft({ ...draft, [row.starsKey!]: event.target.value })}
                  />
                  <span className="text-sm">⭐</span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">0 ⭐</span>
              )}
            </div>
            <Textarea
              rows={2}
              placeholder={`Vantagens do cliente ${row.label} (aparece no portal)`}
              disabled={!canEdit}
              value={draft[row.perksKey]}
              onChange={(event) => setDraft({ ...draft, [row.perksKey]: event.target.value })}
            />
          </div>
        ))}
        {canEdit && (
          <Button className="w-fit" onClick={save} disabled={upsertTiers.isPending}>
            {upsertTiers.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar níveis
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
