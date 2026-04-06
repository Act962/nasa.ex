"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Shield,
  Plus,
  MoreHorizontal,
  ShieldOff,
  RefreshCw,
} from "lucide-react";
import {
  usePaymentAccessList,
  useGrantPaymentAccess,
  useRevokePaymentAccess,
} from "../../hooks/use-payment";
import { toast } from "sonner";
import { useOrgMembers } from "@/features/org/hooks/use-org";

export function AccessPanel() {
  const { data, isLoading } = usePaymentAccessList();
  const grant = useGrantPaymentAccess();
  const revoke = useRevokePaymentAccess();
  const { data: membersData } = useOrgMembers?.() ?? { data: undefined };

  const [showDialog, setShowDialog] = useState(false);
  const [userId, setUserId] = useState("");
  const [sendVia, setSendVia] = useState<"email" | "whatsapp">("email");
  const [phone, setPhone] = useState("");

  const records = data?.records ?? [];

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return toast.error("Selecione um usuário");
    try {
      await grant.mutateAsync({ userId, sendVia, phone: phone || undefined });
      toast.success(`PIN gerado e enviado via ${sendVia === "email" ? "e-mail" : "WhatsApp"}!`);
      setShowDialog(false);
      setUserId("");
      setPhone("");
    } catch {
      toast.error("Erro ao liberar acesso");
    }
  }

  async function handleRevoke(uid: string) {
    try {
      await revoke.mutateAsync({ userId: uid });
      toast.success("Acesso revogado");
    } catch {
      toast.error("Erro ao revogar acesso");
    }
  }

  async function handleRegenerate(uid: string, via: "email" | "whatsapp", ph?: string | null) {
    try {
      await grant.mutateAsync({ userId: uid, sendVia: via, phone: ph || undefined });
      toast.success("Novo PIN gerado e enviado!");
    } catch {
      toast.error("Erro ao regenerar PIN");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Shield className="size-4 text-[#1E90FF]" />
          Controle de Acesso — Payment
        </div>
        <Button
          size="sm"
          onClick={() => setShowDialog(true)}
          className="gap-1.5 bg-[#1E90FF] hover:bg-[#1E90FF]/90 text-white"
        >
          <Plus className="size-3.5" /> Liberar Acesso
        </Button>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Apenas usuários autorizados abaixo podem acessar o módulo financeiro.
        O PIN é gerado aleatoriamente e enviado por e-mail ou WhatsApp. Nenhuma senha é armazenada em texto puro.
      </p>

      <div className="rounded-xl border border-border/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Usuário</th>
              <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Status</th>
              <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Concedido em</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted-foreground text-xs">
                  Carregando...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted-foreground text-xs">
                  Nenhum acesso concedido
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.user.name}</p>
                    <p className="text-xs text-muted-foreground">{r.user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={r.isAuthorized
                        ? "text-green-400 border-green-400/30 bg-green-400/10"
                        : "text-red-400 border-red-400/30 bg-red-400/10"}
                    >
                      {r.isAuthorized ? "Autorizado" : "Revogado"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="gap-2 text-xs"
                          onClick={() => handleRegenerate(r.userId, "email", null)}
                        >
                          <RefreshCw className="size-3.5" /> Novo PIN (e-mail)
                        </DropdownMenuItem>
                        {r.phone && (
                          <DropdownMenuItem
                            className="gap-2 text-xs"
                            onClick={() => handleRegenerate(r.userId, "whatsapp", r.phone)}
                          >
                            <RefreshCw className="size-3.5" /> Novo PIN (WhatsApp)
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="gap-2 text-xs text-red-400"
                          onClick={() => handleRevoke(r.userId)}
                        >
                          <ShieldOff className="size-3.5" /> Revogar Acesso
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog de concessão */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Liberar Acesso ao Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGrant} className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail do Usuário</Label>
              <Input
                placeholder="email@exemplo.com"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Digite o ID ou e-mail do usuário na organização.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Enviar PIN via</Label>
              <Select value={sendVia} onValueChange={(v) => setSendVia(v as "email" | "whatsapp")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {sendVia === "whatsapp" && (
              <div className="space-y-2">
                <Label>Número WhatsApp (com DDI)</Label>
                <Input
                  placeholder="5511999999999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={grant.isPending}
                className="flex-1 bg-[#1E90FF] hover:bg-[#1E90FF]/90 text-white"
              >
                {grant.isPending ? "Enviando..." : "Gerar e Enviar PIN"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
