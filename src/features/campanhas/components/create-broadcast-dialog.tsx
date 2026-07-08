"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
        <Button>
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
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Nenhum número WhatsApp Oficial (Meta Cloud) configurado nesta
            organização. Conecte um número em{" "}
            <Link
              href="/integrations"
              className="font-medium text-foreground underline"
            >
              Integrações
            </Link>{" "}
            para criar campanhas.
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
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Número de origem</Label>
              <Select value={trackingId} onValueChange={setTrackingId}>
                <SelectTrigger>
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

        <DialogFooter>
          <Button
            onClick={handleCreate}
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
      </DialogContent>
    </Dialog>
  );
}
