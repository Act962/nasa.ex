"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Save,
  SearchCheck,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateTrafegoBriefing } from "@/features/trafego/hooks/use-trafego-orders";
import { useCheckTrafegoWhatsappNumber } from "@/features/trafego/hooks/use-trafego-verification";
import { maskPhoneBr } from "@/features/form/lib/masks";
import { TechnicalTerm } from "../technical-term";

type WhatsappCheck =
  | { status: "found"; phone: string; verifiedName: string | null }
  | { status: "not_found"; phone: string }
  | { status: "skipped"; reason: string }
  | { status: "invalid_phone" };

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

export function BriefingForm({
  orderId,
  readOnly,
  initial,
}: BriefingFormProps) {
  const [whatsappCheck, setWhatsappCheck] = useState<WhatsappCheck | null>(
    null,
  );
  const [form, setForm] = useState({
    businessName: initial.businessName ?? "",
    businessNiche: initial.businessNiche ?? "",
    targetAudience: initial.targetAudience ?? "",
    destinationUrl: initial.destinationUrl ?? "",
    whatsappNumber: initial.whatsappNumber ?? "",
    notes: initial.notes ?? "",
  });

  const updateBriefing = useUpdateTrafegoBriefing();
  const checkWhatsapp = useCheckTrafegoWhatsappNumber();
  const whatsappDigits = form.whatsappNumber.replace(/\D/g, "");
  const whatsappCanBeSaved =
    whatsappDigits.length === 0 ||
    whatsappCheck?.status === "found" ||
    whatsappCheck?.status === "skipped";

  function handleCheckWhatsapp() {
    if (whatsappDigits.length < 10) return;
    checkWhatsapp.mutate(
      { phone: form.whatsappNumber },
      {
        onSuccess: (result) => setWhatsappCheck(result),
        onError: (error) => {
          setWhatsappCheck(null);
          toast.error(error.message);
        },
      },
    );
  }

  function handleSave() {
    if (!whatsappCanBeSaved) {
      toast.error("Verifique o WhatsApp antes de salvar o briefing.");
      return;
    }
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
        Quanto mais claro, melhor a segmentação
        <TechnicalTerm term="segmentation" /> que nossa equipe consegue montar.
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
            <div className="flex items-center text-xs">
              <Label className="text-xs">Site ou link de destino</Label>
              <TechnicalTerm term="destinationLink" />
            </div>
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
            <div className="mt-1 flex gap-2">
              <Input
                value={form.whatsappNumber}
                onChange={(event) => {
                  setForm({
                    ...form,
                    whatsappNumber: maskPhoneBr(event.target.value),
                  });
                  setWhatsappCheck(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && whatsappDigits.length >= 10) {
                    event.preventDefault();
                    handleCheckWhatsapp();
                  }
                }}
                disabled={readOnly}
                inputMode="tel"
                placeholder="(11) 90000-0000"
              />
              {!readOnly && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCheckWhatsapp}
                  disabled={
                    whatsappDigits.length < 10 || checkWhatsapp.isPending
                  }
                >
                  {checkWhatsapp.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <SearchCheck className="size-4" />
                  )}
                  Verificar
                </Button>
              )}
            </div>
            {whatsappCheck?.status === "found" && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="size-3.5" />
                Número ativo no WhatsApp
                {whatsappCheck.verifiedName
                  ? ` · ${whatsappCheck.verifiedName}`
                  : ""}
              </p>
            )}
            {whatsappCheck?.status === "not_found" && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-destructive">
                <TriangleAlert className="size-3.5" />
                Número não encontrado no WhatsApp. Confira o DDD e o dígito 9.
              </p>
            )}
            {whatsappCheck?.status === "invalid_phone" && (
              <p className="mt-1.5 text-xs text-destructive">
                Informe um celular válido com DDD.
              </p>
            )}
            {whatsappCheck?.status === "skipped" && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                A consulta está indisponível agora. Você pode salvar; a equipe
                valida depois.
              </p>
            )}
          </div>
        </div>

        <div>
          <Label className="text-xs">Observações para a equipe</Label>
          <Textarea
            value={form.notes}
            onChange={(event) =>
              setForm({ ...form, notes: event.target.value })
            }
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
              disabled={updateBriefing.isPending || !whatsappCanBeSaved}
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
