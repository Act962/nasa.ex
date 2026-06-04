"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useBindings,
  useResetBindingPin,
  useRevokeBinding,
} from "@/features/astro-bot/hooks/use-astro-bot";
import {
  Clock,
  Loader2,
  Lock,
  MessageCircle,
  ShieldOff,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function timeAgo(d: Date | string | null): string {
  if (!d) return "—";
  const ts = typeof d === "string" ? new Date(d).getTime() : d.getTime();
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const days = Math.floor(h / 24);
  return `${days}d atrás`;
}

export function BindingsList() {
  const [scope, setScope] = useState<"mine" | "org">("mine");
  const { bindings, isLoading } = useBindings(scope);
  const revoke = useRevokeBinding();
  const resetPin = useResetBindingPin();

  const [pinDialogId, setPinDialogId] = useState<string | null>(null);
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");

  const handleRevoke = (id: string, phone: string) => {
    if (!confirm(`Revogar vínculo do número ${phone}?`)) return;
    revoke.mutate(
      { bindingId: id },
      {
        onSuccess: () => toast.success("Vínculo revogado"),
        onError: (e) => toast.error(e.message || "Erro ao revogar"),
      },
    );
  };

  const handleResetPin = () => {
    if (!pinDialogId) return;
    if (!/^\d{4,6}$/.test(newPin)) {
      toast.error("PIN deve ter 4-6 dígitos");
      return;
    }
    if (newPin !== newPinConfirm) {
      toast.error("PINs não conferem");
      return;
    }
    resetPin.mutate(
      { bindingId: pinDialogId, newPin },
      {
        onSuccess: () => {
          toast.success("PIN redefinido — sessão atual encerrada");
          setPinDialogId(null);
          setNewPin("");
          setNewPinConfirm("");
        },
        onError: (e) => toast.error(e.message || "Erro ao redefinir"),
      },
    );
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Telefones vinculados</h3>
          <p className="text-sm text-muted-foreground">
            Vínculos ativos hoje. Você pode revogar ou redefinir o PIN a
            qualquer momento.
          </p>
        </div>
        <Tabs value={scope} onValueChange={(v) => setScope(v as "mine" | "org")}>
          <TabsList>
            <TabsTrigger value="mine">Meus</TabsTrigger>
            <TabsTrigger value="org">Da org</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      ) : bindings.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {scope === "mine"
            ? "Você ainda não vinculou nenhum WhatsApp."
            : "Ninguém da org vinculou WhatsApp ainda."}
        </div>
      ) : (
        <div className="space-y-3">
          {bindings.map((b: any) => {
            const isLocked =
              b.pinLockedUntil && new Date(b.pinLockedUntil).getTime() > Date.now();
            const hasSession =
              b.sessionExpiresAt &&
              new Date(b.sessionExpiresAt).getTime() > Date.now();
            return (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {b.user ? (
                    <Avatar className="size-9">
                      {b.user.image && <AvatarImage src={b.user.image} />}
                      <AvatarFallback>
                        {b.user.name?.[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="size-9 rounded-full bg-violet-500/10 flex items-center justify-center">
                      <Smartphone className="size-4 text-violet-500" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {b.user?.name ?? "Eu"} · +{b.phoneE164}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {!b.isActive && (
                        <Badge variant="outline" className="text-xs">
                          Revogado
                        </Badge>
                      )}
                      {isLocked && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <Lock className="size-3" /> Bloqueado (PIN)
                        </Badge>
                      )}
                      {hasSession && (
                        <Badge className="text-xs gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                          <ShieldOff className="size-3" /> Sessão ativa
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MessageCircle className="size-3" />{" "}
                        {b._count?.commands ?? 0} cmds
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3" /> visto{" "}
                        {timeAgo(b.lastSeenAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {scope === "mine" && b.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPinDialogId(b.id)}
                    >
                      <Lock className="size-3 mr-1" /> Novo PIN
                    </Button>
                  )}
                  {b.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(b.id, b.phoneE164)}
                      disabled={revoke.isPending}
                    >
                      <Trash2 className="size-3 mr-1" /> Revogar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!pinDialogId}
        onOpenChange={(v) => {
          if (!v) {
            setPinDialogId(null);
            setNewPin("");
            setNewPinConfirm("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir PIN</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Escolha um novo PIN de 4 a 6 dígitos. Sua sessão atual no
              WhatsApp será encerrada.
            </p>
            <div className="space-y-2">
              <Label>Novo PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                value={newPin}
                onChange={(e) =>
                  setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                value={newPinConfirm}
                onChange={(e) =>
                  setNewPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPinDialogId(null)}
              disabled={resetPin.isPending}
            >
              Cancelar
            </Button>
            <Button onClick={handleResetPin} disabled={resetPin.isPending}>
              {resetPin.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Redefinir"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
