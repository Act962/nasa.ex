"use client";

import { useState } from "react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { TierPlanet } from "./tier-planet";
import {
  useStarFriendsOverview,
  useUpsertStarFriendsTiers,
} from "../hooks/use-star-friends";
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
      <TiersForm
        key={`${program.moonMinStars}-${program.galaxyMinStars}`}
        program={program}
        canEdit={canEdit}
      />
      <section className="flex min-w-0 flex-col gap-4 rounded-[20px] border border-line bg-card p-4">
        <div>
          <h2 className="text-base font-semibold">
            Regras &quot;comprou X, ganhou Y&quot;
          </h2>
          <p className="text-xs text-muted-foreground">
            Cada compra paga vale {program.starsPerPurchase}{" "}
            {program.starsPerPurchase === 1 ? "star" : "stars"}. Ao completar o
            cartão, o cliente troca pelo portal e a loja aprova em Resgates.
          </p>
        </div>
        <RewardsManager canEdit={canEdit} variant="rules" />
      </section>
    </div>
  );
}

function TiersForm({
  program,
  canEdit,
}: {
  program: ProgramTiers;
  canEdit: boolean;
}) {
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
    {
      tier: "EARTH" as const,
      label: "Terra",
      phase: "Fase 1 · todo cliente começa aqui",
      starsKey: null,
      perksKey: "earthPerks" as const,
    },
    {
      tier: "MOON" as const,
      label: "Lua",
      phase: "Fase 2",
      starsKey: "moonMinStars" as const,
      perksKey: "moonPerks" as const,
    },
    {
      tier: "GALAXY" as const,
      label: "Galaxy",
      phase: "Fase 3 · cliente premium",
      starsKey: "galaxyMinStars" as const,
      perksKey: "galaxyPerks" as const,
    },
  ];

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-[20px] border border-line bg-card p-4">
      <div>
        <h2 className="text-base font-semibold">Níveis do cliente</h2>
        <p className="text-xs text-muted-foreground">
          Contam as stars ganhas na vida toda. Trocar prêmios não faz o cliente
          descer.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {rows.map((row) => (
          <div
            key={row.tier}
            className="flex flex-col gap-2 border-b border-line pb-4 last:border-0 last:pb-0"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <TierPlanet tier={row.tier} size={32} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.phase}</p>
                </div>
              </div>
              {row.starsKey ? (
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`tier-${row.tier}`}
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    a partir de
                  </Label>
                  <Input
                    id={`tier-${row.tier}`}
                    type="number"
                    min={1}
                    className="flex-1 sm:w-24 sm:flex-none"
                    disabled={!canEdit}
                    value={draft[row.starsKey]}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        [row.starsKey!]: event.target.value,
                      })
                    }
                  />
                  <Star
                    className="size-4 shrink-0 fill-current text-warning"
                    aria-label="stars"
                  />
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  0{" "}
                  <Star className="size-3.5 fill-current" aria-label="stars" />
                </span>
              )}
            </div>
            <Textarea
              rows={2}
              placeholder={`Vantagens do cliente ${row.label} (aparece no portal)`}
              disabled={!canEdit}
              value={draft[row.perksKey]}
              onChange={(event) =>
                setDraft({ ...draft, [row.perksKey]: event.target.value })
              }
            />
          </div>
        ))}
        {canEdit && (
          <Button
            className="w-full rounded-full sm:w-fit"
            onClick={save}
            disabled={upsertTiers.isPending}
          >
            {upsertTiers.isPending && <OrbitaSpinner className="size-4 " />}
            Salvar níveis
          </Button>
        )}
      </div>
    </section>
  );
}
