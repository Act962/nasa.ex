"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useReviewStarFriendsCampaignReceipt } from "../hooks/use-star-friends-campaign";
import { toBrasiliaDay } from "../utils/campaign";

// Conferência manual do cupom que a leitura automática não resolveu (spec 0102, RF-15).

const reviewSchema = z.object({
  total: z.number({ message: "Informe o valor total" }).min(0.01, "Informe o valor total"),
  issuedOn: z.string(),
  receiptNumber: z.string().trim().max(20),
});

type ReviewValues = z.infer<typeof reviewSchema>;

export type ReceiptInReview = {
  id: string;
  totalCents: number | null;
  issuedAt: Date | string | null;
  receiptNumber: string | null;
};

const NOT_NOTIFIED_HINT = "Fora da janela de 24 h do WhatsApp: o cliente não foi avisado na conversa.";

export function CampaignReceiptReview({ receipt }: { receipt: ReceiptInReview }) {
  const review = useReviewStarFriendsCampaignReceipt();
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const form = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      total: receipt.totalCents !== null ? receipt.totalCents / 100 : Number.NaN,
      issuedOn: receipt.issuedAt ? toBrasiliaDay(new Date(receipt.issuedAt)) : "",
      receiptNumber: receipt.receiptNumber ?? "",
    },
  });

  const approve = form.handleSubmit((values) =>
    review.mutate(
      {
        decision: "approve",
        receiptId: receipt.id,
        totalCents: Math.round(values.total * 100),
        issuedOn: values.issuedOn || null,
        receiptNumber: values.receiptNumber || null,
      },
      {
        onSuccess: (result) => {
          if (result.decision !== "approved") return;
          const numbersLabel = result.codes.length === 0 ? "valor guardado para o próximo número" : `${result.codes.length} número(s) da sorte`;
          toast.success(`Cupom aprovado: ${numbersLabel}.`, { description: result.wasCustomerNotified ? "Cliente avisado no WhatsApp." : NOT_NOTIFIED_HINT });
        },
        onError: (error) => toast.error(error.message),
      },
    ),
  );

  const reject = () =>
    review.mutate(
      { decision: "reject", receiptId: receipt.id, rejectReason: rejectReason.trim() || null },
      {
        onSuccess: (result) => toast.success("Cupom recusado.", { description: result.wasCustomerNotified ? "Cliente avisado no WhatsApp." : NOT_NOTIFIED_HINT }),
        onError: (error) => toast.error(error.message),
      },
    );

  if (isRejecting) {
    return (
      <div className="flex flex-col gap-2 rounded-[14px] bg-muted p-3">
        <Field>
          <FieldLabel htmlFor={`reject-reason-${receipt.id}`}>Motivo da recusa (opcional)</FieldLabel>
          <Input
            id={`reject-reason-${receipt.id}`}
            value={rejectReason}
            maxLength={200}
            placeholder="Ex.: a foto não mostra o valor"
            onChange={(event) => setRejectReason(event.target.value)}
          />
          <FieldDescription>O cliente recebe este texto na conversa.</FieldDescription>
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" className="rounded-full" disabled={review.isPending} onClick={() => setIsRejecting(false)}>
            Voltar
          </Button>
          <Button type="button" size="sm" variant="destructive" className="rounded-full" disabled={review.isPending} onClick={reject}>
            {review.isPending && <OrbitaSpinner className="size-4" />} Confirmar recusa
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-2 rounded-[14px] bg-muted p-3" onSubmit={approve}>
      <Controller
        control={form.control}
        name="total"
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel htmlFor={`review-total-${receipt.id}`}>Valor total (R$)</FieldLabel>
            <Input
              id={`review-total-${receipt.id}`}
              type="number"
              inputMode="decimal"
              min={0.01}
              step="0.01"
              value={Number.isNaN(field.value) ? "" : field.value}
              onChange={(event) => field.onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))}
            />
            {fieldState.error && <FieldDescription className="text-destructive">{fieldState.error.message}</FieldDescription>}
          </Field>
        )}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Controller
          control={form.control}
          name="issuedOn"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={`review-date-${receipt.id}`}>Data da compra</FieldLabel>
              <Input id={`review-date-${receipt.id}`} type="date" {...field} />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="receiptNumber"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor={`review-number-${receipt.id}`}>Número do cupom</FieldLabel>
              <Input id={`review-number-${receipt.id}`} inputMode="numeric" maxLength={20} {...field} />
            </Field>
          )}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={review.isPending} onClick={() => setIsRejecting(true)}>
          Recusar
        </Button>
        <Button type="submit" size="sm" className="rounded-full" disabled={review.isPending} data-guide={GUIDE_ANCHORS.starFriendsCampaignReviewApprove.id}>
          {review.isPending && <OrbitaSpinner className="size-4" />} Aprovar
        </Button>
      </div>
    </form>
  );
}
