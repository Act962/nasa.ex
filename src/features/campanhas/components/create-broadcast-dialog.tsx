"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSendingNumbers } from "../hooks/use-sending-numbers";
import { useCreateBroadcast } from "../hooks/use-broadcasts";
import { CONNECT_NUMBER_EVENT } from "./self-service/official-number-overview";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { emitTourResult } from "@/features/tour/store";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";

export function CreateBroadcastDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [trackingId, setTrackingId] = useState<string>("");

  const { data: numbers, isLoading: loadingNumbers } = useSendingNumbers({
    enabled: open,
  });
  const createBroadcast = useCreateBroadcast();

  const hasNumbers = !!numbers && numbers.length > 0;

  function handleCreate() {
    if (!name.trim() || !trackingId) return;
    createBroadcast.mutate(
      { name: name.trim(), trackingId },
      {
        onSuccess: (broadcast) => {
          toast.success("Campanha criada");
          setOpen(false);
          setName("");
          setTrackingId("");
          router.push(`/campanhas/${broadcast.id}`);
          emitTourResult({ kind: GUIDE_RESULT_KINDS.broadcastCreated });
        },
        onError: (error) => {
          toast.error(error.message ?? "Não foi possível criar a campanha");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-guide={GUIDE_ANCHORS.campaignNewButton.id}>
          <Plus className="size-4" /> Nova campanha
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova campanha</DialogTitle>
          <DialogDescription>
            Escolha o número WhatsApp Oficial de origem e dê um nome à campanha.
          </DialogDescription>
        </DialogHeader>

        {!loadingNumbers && !hasNumbers ? (
          <div className="space-y-3 rounded-md border border-dashed p-4 text-sm">
            <p className="font-medium">Primeiro, conecte seu WhatsApp oficial</p>
            <p className="text-muted-foreground">
              A campanha sai por um número oficial da Meta. A gente te guia passo a passo — leva uns 10 minutos.
            </p>
            <Button
              size="sm"
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new Event(CONNECT_NUMBER_EVENT));
              }}
            >
              Conectar meu WhatsApp
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="broadcast-name">Nome</Label>
              <Input
                id="broadcast-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex: Promoção de Julho"
                autoFocus
                data-guide={GUIDE_ANCHORS.campaignName.id}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Número de origem</Label>
              <Select value={trackingId} onValueChange={setTrackingId}>
                <SelectTrigger data-guide={GUIDE_ANCHORS.campaignSendingNumber.id}>
                  <SelectValue
                    placeholder={
                      loadingNumbers ? "Carregando…" : "Selecione um número"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {numbers?.map((number) => (
                    <SelectItem
                      key={number.trackingId}
                      value={number.trackingId}
                    >
                      {number.trackingName}
                      {number.phoneNumber ? ` · ${number.phoneNumber}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {hasNumbers && (
        <DialogFooter>
          <Button
            onClick={handleCreate}
            data-guide={GUIDE_ANCHORS.campaignCreateSubmit.id}
            disabled={
              !hasNumbers ||
              !name.trim() ||
              !trackingId ||
              createBroadcast.isPending
            }
          >
            {createBroadcast.isPending ? "Criando…" : "Criar campanha"}
          </Button>
        </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
