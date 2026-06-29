"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { useSendStar, useMyStation } from "../hooks/use-station";
import { toast } from "sonner";

interface Props {
  toNick: string;
}

export function StationSendStar({ toNick }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(1);
  const [message, setMessage] = useState("");
  const { data: myData } = useMyStation("ORG");
  const sendStar = useSendStar();

  const fromNick = myData?.station?.nick;

  async function handleSend() {
    if (!fromNick) {
      toast.error("Você precisa ter uma Space Station para enviar STARs");
      return;
    }
    try {
      await sendStar.mutateAsync({ fromNick, toNick, amount, message: message || undefined });
      toast.success(`${amount} STAR${amount > 1 ? "s" : ""} enviado${amount > 1 ? "s" : ""}!`);
      setOpen(false);
      setAmount(1);
      setMessage("");
    } catch {
      toast.error("Erro ao enviar STARs");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 gap-2">
          <Star className="h-4 w-4" />
          Enviar STAR
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Enviar STARs para @{toNick}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Quantidade de STARs</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="bg-slate-800 border-white/10"
            />
          </div>
          <div>
            <Label>Mensagem (opcional)</Label>
            <Textarea
              placeholder="Deixe uma mensagem de reconhecimento..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={200}
              className="bg-slate-800 border-white/10 resize-none"
              rows={3}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={sendStar.isPending}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
          >
            {sendStar.isPending ? "Enviando..." : `Enviar ${amount} STAR${amount > 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
