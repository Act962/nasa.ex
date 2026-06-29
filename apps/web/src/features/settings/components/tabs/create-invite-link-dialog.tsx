"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Check, LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useOrgRole } from "@/hooks/use-org-role";

type Role = "admin" | "member" | "moderador";

const DURATION_PRESETS: { label: string; days: number }[] = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
  { label: "1 ano", days: 365 },
  { label: "3 anos", days: 365 * 3 },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateInviteLinkDialog({
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const { isMaster } = useOrgRole();
  const [role, setRole] = useState<Role>("member");
  const [durationKey, setDurationKey] = useState<string>("7");
  const [customDays, setCustomDays] = useState<string>("");
  const [starsOnJoin, setStarsOnJoin] = useState<string>("0");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMut = useMutation({
    mutationFn: (v: {
      role: Role;
      durationDays: number;
      starsOnJoin: number;
    }) => orpc.inviteLinks.create.call(v),
    onSuccess: (link) => {
      setCreatedToken(link.token);
      toast.success("Link de convite criado");
      onCreated?.();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar link"),
  });

  const reset = () => {
    setRole("member");
    setDurationKey("7");
    setCustomDays("");
    setStarsOnJoin("0");
    setCreatedToken(null);
    setCopied(false);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleSubmit = () => {
    let durationDays: number;
    if (durationKey === "custom") {
      const parsed = parseInt(customDays, 10);
      if (!parsed || parsed <= 0) {
        toast.error("Informe a duração em dias");
        return;
      }
      durationDays = parsed;
    } else {
      durationDays = parseInt(durationKey, 10);
    }

    const stars = parseInt(starsOnJoin || "0", 10);
    if (Number.isNaN(stars) || stars < 0) {
      toast.error("Quantidade de stars inválida");
      return;
    }

    createMut.mutate({ role, durationDays, starsOnJoin: stars });
  };

  const linkUrl = createdToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${createdToken}`
    : "";

  const handleCopy = () => {
    if (!linkUrl) return;
    navigator.clipboard.writeText(linkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copiado");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}
    >
      <DialogContent>
        {!createdToken ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LinkIcon className="size-4" />
                Criar link de convite
              </DialogTitle>
              <DialogDescription>
                Qualquer pessoa com o link poderá entrar na organização até o
                link expirar.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    {isMaster && (
                      <SelectItem value="moderador">Moderador</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Validade</Label>
                <Select value={durationKey} onValueChange={setDurationKey}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_PRESETS.map((p) => (
                      <SelectItem key={p.days} value={String(p.days)}>
                        {p.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
                {durationKey === "custom" && (
                  <Input
                    type="number"
                    min={1}
                    placeholder="Dias"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Stars ao entrar</Label>
                <Input
                  type="number"
                  min={0}
                  value={starsOnJoin}
                  onChange={(e) => setStarsOnJoin(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Valor guardado no link. A distribuição automática ao entrar
                  será implementada em breve.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={createMut.isPending}>
                {createMut.isPending ? "Criando..." : "Criar link"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Link criado</DialogTitle>
              <DialogDescription>
                Compartilhe este link com quem você quer convidar.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-3">
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/40">
                <span className="text-xs truncate flex-1">{linkUrl}</span>
                <Button size="sm" variant="ghost" onClick={handleCopy}>
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Fechar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
