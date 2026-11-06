"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useSetStarFriendsPrizeCount, useStarFriendsCampaign } from "../hooks/use-star-friends-campaign";

const MIN_PRIZES = 1;
const MAX_PRIZES = 100;

type PrizeCountFieldProps = { campaignId: string; prizeCount: number; winnersCount: number };

/** A chave reinicia o rascunho quando a quantidade salva muda (outra aba, outra pessoa). */
export function CampaignPrizeCountField(props: PrizeCountFieldProps) {
  return <PrizeCountForm key={props.prizeCount} {...props} />;
}

function PrizeCountForm({ campaignId, prizeCount, winnersCount }: PrizeCountFieldProps) {
  const setPrizeCount = useSetStarFriendsPrizeCount();
  const [draft, setDraft] = useState(String(prizeCount));
  const parsedPrizeCount = Number(draft);
  const isValid = Number.isInteger(parsedPrizeCount) && parsedPrizeCount >= MIN_PRIZES && parsedPrizeCount <= MAX_PRIZES;

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isValid) return;
        setPrizeCount.mutate(
          { campaignId, prizeCount: parsedPrizeCount },
          {
            onSuccess: () => toast.success(`O sorteio agora tem ${parsedPrizeCount} ganhador${parsedPrizeCount === 1 ? "" : "es"}`),
            onError: (error) => toast.error(error.message),
          },
        );
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">Quantidade de ganhadores</span>
        <Input
          type="number"
          inputMode="numeric"
          min={Math.max(MIN_PRIZES, winnersCount)}
          max={MAX_PRIZES}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="h-10 w-28 rounded-full text-center text-base font-semibold tabular-nums"
          data-guide={GUIDE_ANCHORS.starFriendsPrizeCount.id}
        />
      </label>
      <Button type="submit" variant="outline" className="h-10 rounded-full" disabled={!isValid || parsedPrizeCount === prizeCount || setPrizeCount.isPending}>
        {setPrizeCount.isPending && <OrbitaSpinner className="size-4" />} Salvar
      </Button>
      <span className="basis-full text-[11px] text-muted-foreground">
        Cada pessoa ganha no máximo um prêmio.{winnersCount > 0 ? ` Já há ${winnersCount} sorteado(s).` : ""}
      </span>
    </form>
  );
}

/** Cartão da aba Configurações: a quantidade de ganhadores sem precisar abrir a campanha. */
export function CampaignPrizeCountCard() {
  const campaignQuery = useStarFriendsCampaign();
  const campaign = campaignQuery.data?.campaign;
  const winnersCount = campaignQuery.data?.draws.filter((draw) => !draw.revokedAt).length ?? 0;

  return (
    <section className="flex w-full flex-col gap-3 rounded-[20px] border border-line bg-card p-4 md:max-w-2xl md:p-5">
      <div className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-full bg-warning/15 text-warning">
          <Trophy className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Sorteio da campanha</h2>
          <p className="truncate text-xs text-muted-foreground">{campaign ? campaign.name : "Crie a campanha na aba Campanha."}</p>
        </div>
      </div>
      {campaignQuery.isLoading && <OrbitaSpinner className="size-5" />}
      {campaign && <CampaignPrizeCountField campaignId={campaign.id} prizeCount={campaign.prizeCount} winnersCount={winnersCount} />}
    </section>
  );
}
