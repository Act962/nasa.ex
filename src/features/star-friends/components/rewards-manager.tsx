"use client";

import { useState } from "react";
import { Gift, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStarFriendsRewards, useUpsertStarFriendsReward } from "../hooks/use-star-friends";
import { REWARD_TYPE_LABELS } from "../utils/labels";

type RewardType = "PRODUCT" | "DISCOUNT" | "PRIZE";

type RewardDraft = {
  id?: string;
  type: RewardType;
  name: string;
  description: string;
  costStars: string;
  discountValue: string;
  discountPercent: string;
  stock: string;
  isActive: boolean;
};

const EMPTY_DRAFT: RewardDraft = {
  type: "PRODUCT",
  name: "",
  description: "",
  costStars: "10",
  discountValue: "",
  discountPercent: "",
  stock: "",
  isActive: true,
};

const toNullableNumber = (value: string) => (value.trim() === "" ? null : Number(value));

export function RewardsManager({ canEdit }: { canEdit: boolean }) {
  const rewards = useStarFriendsRewards();
  const upsert = useUpsertStarFriendsReward();
  const [draft, setDraft] = useState<RewardDraft | null>(null);

  const save = () => {
    if (!draft) return;
    upsert.mutate(
      {
        id: draft.id,
        type: draft.type,
        name: draft.name,
        description: draft.description || null,
        imageUrl: null,
        costStars: Number(draft.costStars),
        discountValue: draft.type === "DISCOUNT" ? toNullableNumber(draft.discountValue) : null,
        discountPercent: draft.type === "DISCOUNT" ? toNullableNumber(draft.discountPercent) : null,
        stock: toNullableNumber(draft.stock),
        isActive: draft.isActive,
      },
      {
        onSuccess: () => {
          toast.success("Prêmio salvo");
          setDraft(null);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          O que o cliente pode ganhar trocando stars. Estoque em branco = ilimitado.
        </p>
        {canEdit && (
          <Button onClick={() => setDraft(EMPTY_DRAFT)}>
            <Plus className="size-4" /> Novo prêmio
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rewards.data?.rewards.map((reward) => (
          <div key={reward.id} className="flex flex-col gap-2 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{REWARD_TYPE_LABELS[reward.type]}</Badge>
              {!reward.isActive && <Badge variant="outline">Inativo</Badge>}
            </div>
            <p className="flex items-center gap-2 font-semibold">
              <Gift className="size-4 text-primary" /> {reward.name}
            </p>
            {reward.description && <p className="text-sm text-muted-foreground">{reward.description}</p>}
            <p className="text-sm">
              <span className="font-bold text-amber-500">{reward.costStars} stars</span>
              {reward.stock !== null && <span className="text-muted-foreground"> · {reward.stock} em estoque</span>}
            </p>
            {canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="w-fit"
              onClick={() =>
                setDraft({
                  id: reward.id,
                  type: reward.type,
                  name: reward.name,
                  description: reward.description ?? "",
                  costStars: String(reward.costStars),
                  discountValue: reward.discountValue?.toString() ?? "",
                  discountPercent: reward.discountPercent?.toString() ?? "",
                  stock: reward.stock?.toString() ?? "",
                  isActive: reward.isActive,
                })
              }
            >
              <Pencil className="size-3.5" /> Editar
            </Button>
            )}
          </div>
        ))}
        {rewards.data?.rewards.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum prêmio ainda. Crie o primeiro.</p>
        )}
      </div>

      <Dialog open={draft !== null} onOpenChange={(isOpen) => !isOpen && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar prêmio" : "Novo prêmio"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="flex flex-col gap-3">
              <Label>Tipo</Label>
              <Select value={draft.type} onValueChange={(type) => setDraft({ ...draft, type: type as RewardType })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRODUCT">Produto</SelectItem>
                  <SelectItem value="DISCOUNT">Desconto</SelectItem>
                  <SelectItem value="PRIZE">Prêmio</SelectItem>
                </SelectContent>
              </Select>
              <Label htmlFor="reward-name">Nome</Label>
              <Input id="reward-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              <Label htmlFor="reward-description">Descrição</Label>
              <Textarea
                id="reward-description"
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
              <Label htmlFor="reward-cost">Custo em stars</Label>
              <Input
                id="reward-cost"
                type="number"
                min={1}
                value={draft.costStars}
                onChange={(event) => setDraft({ ...draft, costStars: event.target.value })}
              />
              {draft.type === "DISCOUNT" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="reward-discount-value">Desconto em R$</Label>
                    <Input
                      id="reward-discount-value"
                      type="number"
                      value={draft.discountValue}
                      onChange={(event) => setDraft({ ...draft, discountValue: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="reward-discount-percent">ou em %</Label>
                    <Input
                      id="reward-discount-percent"
                      type="number"
                      value={draft.discountPercent}
                      onChange={(event) => setDraft({ ...draft, discountPercent: event.target.value })}
                    />
                  </div>
                </div>
              )}
              <Label htmlFor="reward-stock">Estoque</Label>
              <Input
                id="reward-stock"
                type="number"
                min={0}
                placeholder="Ilimitado"
                value={draft.stock}
                onChange={(event) => setDraft({ ...draft, stock: event.target.value })}
              />
              <div className="flex items-center gap-2">
                <Switch
                  id="reward-active"
                  checked={draft.isActive}
                  onCheckedChange={(isActive) => setDraft({ ...draft, isActive })}
                />
                <Label htmlFor="reward-active">Disponível para troca</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={upsert.isPending || !draft?.name.trim()}>
              {upsert.isPending && <Loader2 className="size-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
