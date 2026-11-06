"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, ReceiptText, Search } from "lucide-react";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { cn } from "@/lib/utils";
import { useAddStarFriendsManualReceipt, useStarFriendsCampaignParticipants } from "../hooks/use-star-friends-campaign";
import { computeLuckyNumbers, formatCents } from "../utils/campaign";

// Lançar cupom pela tela (spec 0134, RF-8): para a compra que não chegou pelo WhatsApp. Os números
// saem pela mesma conta do cupom normal, somando a sobra do participante.

const manualReceiptSchema = z.object({
  total: z.number({ message: "Informe o valor da compra" }).min(0.01, "Informe o valor da compra"),
  issuedOn: z.string(),
  receiptNumber: z.string().trim().max(20),
  reason: z.string().trim().min(3, "Escreva o motivo"),
});

type ManualReceiptValues = z.infer<typeof manualReceiptSchema>;

type SelectedParticipant = { memberId: string; name: string; phone: string; carryOverCents: number; validNumbers: number };

export function CampaignManualReceiptDialog({ campaignId, amountPerNumberCents }: { campaignId: string; amountPerNumberCents: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [participant, setParticipant] = useState<SelectedParticipant | null>(null);
  const participantsQuery = useStarFriendsCampaignParticipants(campaignId, search.trim(), isOpen && !participant);
  const addReceipt = useAddStarFriendsManualReceipt();
  const form = useForm<ManualReceiptValues>({
    resolver: zodResolver(manualReceiptSchema),
    defaultValues: { total: Number.NaN, issuedOn: "", receiptNumber: "", reason: "" },
  });
  const total = useWatch({ control: form.control, name: "total" });
  const previewNumbers =
    participant && Number.isFinite(total) && total > 0
      ? computeLuckyNumbers({ carryOverCents: participant.carryOverCents, totalCents: Math.round(total * 100), amountPerNumberCents })
      : null;

  const reset = () => {
    setSearch("");
    setParticipant(null);
    form.reset();
  };

  const submit = form.handleSubmit((values) => {
    if (!participant) return;
    addReceipt.mutate(
      {
        campaignId,
        memberId: participant.memberId,
        totalCents: Math.round(values.total * 100),
        issuedOn: values.issuedOn || null,
        receiptNumber: values.receiptNumber || null,
        reason: values.reason,
      },
      {
        onSuccess: (result) => {
          toast.success(`Cupom lançado para ${participant.name}: ${result.codes.length} número(s) da sorte.`, {
            description: result.codes.length > 0 ? result.codes.slice(0, 20).join(", ") : `Sobra de ${formatCents(result.carryOverCents)} guardada.`,
          });
          setIsOpen(false);
          reset();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  });

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextIsOpen) => {
        setIsOpen(nextIsOpen);
        if (!nextIsOpen) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full" data-guide={GUIDE_ANCHORS.starFriendsCampaignManualReceipt.id}>
          <ReceiptText className="size-4" /> Lançar cupom manual
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lançar cupom manual</DialogTitle>
          <DialogDescription>
            Para a compra que não chegou pelo WhatsApp. Os números saem pela conta de sempre, somando a sobra do participante. Depois, faça a
            varredura de novo antes de sortear.
          </DialogDescription>
        </DialogHeader>

        {!participant ? (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus className="pl-9" placeholder="Buscar participante por nome ou telefone" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <ul className="flex max-h-72 flex-col overflow-y-auto rounded-[14px] border border-line">
              {participantsQuery.isLoading && <OrbitaSpinner className="mx-auto my-4 size-5" />}
              {participantsQuery.data?.participants.map((option) => (
                <li key={option.memberId}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted"
                    onClick={() => setParticipant(option)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{option.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{option.phone}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{option.validNumbers} número(s)</span>
                  </button>
                </li>
              ))}
              {participantsQuery.data?.participants.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-muted-foreground">Ninguém cadastrado na campanha com esse nome ou telefone.</li>
              )}
            </ul>
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <div className="flex items-center justify-between gap-3 rounded-[14px] bg-muted p-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <Check className="size-4 shrink-0 text-success" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{participant.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {participant.phone} · {participant.validNumbers} número(s) · sobra {formatCents(participant.carryOverCents)}
                  </span>
                </span>
              </span>
              <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => setParticipant(null)}>
                Trocar
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="total"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="manual-total">Valor da compra (R$)</FieldLabel>
                    <Input
                      id="manual-total"
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={Number.isFinite(field.value) ? field.value : ""}
                      onChange={(event) => field.onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))}
                    />
                    <FieldDescription className={cn(fieldState.error && "text-destructive")}>
                      {fieldState.error?.message ??
                        (previewNumbers ? `Rende ${previewNumbers.numbers} número(s) e deixa ${formatCents(previewNumbers.carryOverCents)} de sobra.` : " ")}
                    </FieldDescription>
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="issuedOn"
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="manual-date">Data da compra (opcional)</FieldLabel>
                    <Input id="manual-date" type="date" {...field} />
                  </Field>
                )}
              />
            </div>
            <Controller
              control={form.control}
              name="receiptNumber"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="manual-number">Número do cupom (opcional)</FieldLabel>
                  <Input id="manual-number" inputMode="numeric" {...field} />
                  <FieldDescription>Com número, data e valor, o cupom repetido é barrado.</FieldDescription>
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="reason"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="manual-reason">Motivo</FieldLabel>
                  <Input id="manual-reason" placeholder="Ex.: cliente trouxe o cupom na loja" maxLength={200} {...field} />
                  {fieldState.error && <FieldDescription className="text-destructive">{fieldState.error.message}</FieldDescription>}
                </Field>
              )}
            />
            <Button type="submit" className="self-end rounded-full" disabled={addReceipt.isPending}>
              {addReceipt.isPending && <OrbitaSpinner className="size-4" />} Lançar cupom
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
