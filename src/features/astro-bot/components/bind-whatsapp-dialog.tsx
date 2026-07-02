"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateBinding,
  useOrgMembers,
} from "@/features/astro-bot/hooks/use-astro-bot";
import { Loader2, MessageCircle, Smartphone, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Adiciona um número à allow-list do Astro. Fluxo simples (sem OTP/PIN): admin
 * informa o telefone e escolhe em nome de qual membro o Astro vai consultar.
 */
export function BindWhatsappDialog({
  trigger,
  onSuccess,
}: {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [userId, setUserId] = useState("");

  const { members, isLoading: loadingMembers } = useOrgMembers();
  const create = useCreateBinding();

  const reset = () => {
    setPhone("");
    setUserId("");
  };

  const handleCreate = () => {
    if (!/^\d{10,15}$/.test(phone)) {
      toast.error("Telefone deve ser só dígitos (10-15) com DDI + DDD");
      return;
    }
    if (!userId) {
      toast.error("Escolha o membro que o número representa");
      return;
    }
    create.mutate(
      { phoneE164: phone, userId },
      {
        onSuccess: () => {
          toast.success("Número adicionado à allow-list");
          setOpen(false);
          reset();
          onSuccess?.();
        },
        onError: (e) => toast.error(e.message || "Erro ao adicionar"),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <MessageCircle className="size-4 mr-2" />
            Adicionar número
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar número permitido</DialogTitle>
          <DialogDescription>
            Só números na allow-list conversam com o Astro. As demais mensagens
            seguem o atendimento normal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Smartphone className="size-4" /> Telefone (DDI + DDD + número)
            </Label>
            <Input
              placeholder="5511999998888"
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/\D/g, "").slice(0, 15))
              }
            />
            <p className="text-xs text-muted-foreground">
              Apenas dígitos, ex: <span className="font-mono">5511...</span> pra
              Brasil.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="size-4" /> Em nome de qual membro
            </Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingMembers ? "Carregando…" : "Selecione um membro"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.user?.name || member.user?.email || member.userId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O Astro consulta os dados com as permissões desse membro.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={create.isPending || !phone || !userId}
          >
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Adicionar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
