"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateTrafegoBriefing } from "@/features/trafego/hooks/use-trafego-orders";

interface BriefingFormProps {
  orderId: string;
  readOnly: boolean;
  initial: {
    businessName: string | null;
    businessNiche: string | null;
    targetAudience: string | null;
    destinationUrl: string | null;
    whatsappNumber: string | null;
    notes: string | null;
  };
}

export function BriefingForm({ orderId, readOnly, initial }: BriefingFormProps) {
  const [form, setForm] = useState({
    businessName: initial.businessName ?? "",
    businessNiche: initial.businessNiche ?? "",
    targetAudience: initial.targetAudience ?? "",
    destinationUrl: initial.destinationUrl ?? "",
    whatsappNumber: initial.whatsappNumber ?? "",
    notes: initial.notes ?? "",
  });

  const updateBriefing = useUpdateTrafegoBriefing();

  function handleSave() {
    updateBriefing.mutate(
      { orderId, ...form },
      {
        onSuccess: () => toast.success("Briefing salvo."),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold">Sobre a campanha</h3>
      <p className="text-xs text-muted-foreground">
        Quanto mais claro, melhor a segmentação que nossa equipe consegue montar.
      </p>

      <div className="mt-4 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Nome do negócio</Label>
            <Input
              value={form.businessName}
              onChange={(event) =>
                setForm({ ...form, businessName: event.target.value })
              }
              disabled={readOnly}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Ramo de atuação</Label>
            <Input
              value={form.businessNiche}
              onChange={(event) =>
                setForm({ ...form, businessNiche: event.target.value })
              }
              disabled={readOnly}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Quem você quer alcançar</Label>
          <Textarea
            value={form.targetAudience}
            onChange={(event) =>
              setForm({ ...form, targetAudience: event.target.value })
            }
            disabled={readOnly}
            rows={3}
            placeholder="Idade, região, interesses, comportamento de compra…"
            className="mt-1"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Site ou link de destino</Label>
            <Input
              value={form.destinationUrl}
              onChange={(event) =>
                setForm({ ...form, destinationUrl: event.target.value })
              }
              disabled={readOnly}
              placeholder="https://..."
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">WhatsApp que recebe os contatos</Label>
            <Input
              value={form.whatsappNumber}
              onChange={(event) =>
                setForm({ ...form, whatsappNumber: event.target.value })
              }
              disabled={readOnly}
              placeholder="(11) 90000-0000"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Observações para a equipe</Label>
          <Textarea
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            disabled={readOnly}
            rows={3}
            placeholder="Promoções, datas importantes, o que não pode aparecer…"
            className="mt-1"
          />
        </div>

        {!readOnly && (
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={updateBriefing.isPending}
            >
              {updateBriefing.isPending ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 size-4" />
              )}
              Salvar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
