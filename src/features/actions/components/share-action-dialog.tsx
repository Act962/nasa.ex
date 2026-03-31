"use client";

import { useState } from "react";
import { Share2Icon, Building2Icon, SendIcon, ClockIcon, CheckCircle2Icon, XCircleIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useShareAction,
  useListOutgoingShares,
  useGetCompanyCode,
} from "@/features/workspace/hooks/use-workspace";
import { cn } from "@/lib/utils";

interface Props {
  actionId: string;
  actionTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_CONFIG = {
  PENDING:  { label: "Aguardando", color: "bg-yellow-500/15 text-yellow-600 border-yellow-300", icon: ClockIcon },
  APPROVED: { label: "Aprovado",   color: "bg-emerald-500/15 text-emerald-600 border-emerald-300", icon: CheckCircle2Icon },
  REJECTED: { label: "Rejeitado",  color: "bg-red-500/15 text-red-600 border-red-300", icon: XCircleIcon },
} as const;

export function ShareActionDialog({ actionId, actionTitle, open, onOpenChange }: Props) {
  const [companyCode, setCompanyCode] = useState("");
  const [message, setMessage] = useState("");

  const shareAction = useShareAction();
  const { shares: outgoing, isLoading: loadingOutgoing } = useListOutgoingShares();
  const { data: codeData } = useGetCompanyCode();

  // Filter outgoing shares for this specific action
  const actionShares = outgoing.filter((s: any) => s.sourceAction.id === actionId);

  const handleSend = () => {
    if (!companyCode.trim()) return;
    shareAction.mutate(
      { actionId, companyCode: companyCode.trim(), message: message.trim() || undefined },
      {
        onSuccess: () => {
          setCompanyCode("");
          setMessage("");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Share2Icon className="size-4 text-violet-500" />
            Compartilhar card com outra empresa
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            <span className="font-medium text-foreground">{actionTitle}</span>
          </p>
        </DialogHeader>

        <Tabs defaultValue="send" className="flex flex-col">
          <TabsList className="mx-5 mt-4 w-fit">
            <TabsTrigger value="send">Enviar</TabsTrigger>
            <TabsTrigger value="history">
              Histórico
              {actionShares.length > 0 && (
                <Badge className="ml-1.5 h-4 px-1 text-[10px]">{actionShares.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── SEND TAB ────────────────────────────────── */}
          <TabsContent value="send" className="px-5 pb-5 pt-4 space-y-4 mt-0">
            {/* My company code */}
            {codeData?.companyCode && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/60 border text-sm">
                <Building2Icon className="size-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Seu código:</span>
                <code className="font-mono font-bold text-foreground tracking-widest text-base">
                  {codeData.companyCode}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs ml-auto"
                  onClick={() => {
                    navigator.clipboard.writeText(codeData.companyCode!);
                  }}
                >
                  Copiar
                </Button>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm">Código da empresa destino</Label>
              <Input
                placeholder="Ex: A3F9B2"
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                className="font-mono tracking-widest uppercase text-center text-lg h-11"
                maxLength={6}
              />
              <p className="text-[11px] text-muted-foreground">
                Peça o código de 6 dígitos para a empresa que deseja receber o card.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Mensagem (opcional)</Label>
              <Textarea
                placeholder="Adicione um contexto para a empresa destino..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="resize-none text-sm"
                rows={3}
              />
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleSend}
              disabled={!companyCode.trim() || companyCode.length < 6 || shareAction.isPending}
            >
              <SendIcon className="size-4" />
              {shareAction.isPending ? "Enviando..." : "Enviar para aprovação"}
            </Button>
          </TabsContent>

          {/* ── HISTORY TAB ─────────────────────────────── */}
          <TabsContent value="history" className="px-5 pb-5 pt-4 mt-0">
            {loadingOutgoing ? (
              <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
            ) : actionShares.length === 0 ? (
              <div className="text-center py-8 space-y-1">
                <Share2Icon className="size-8 text-muted-foreground mx-auto opacity-40" />
                <p className="text-sm text-muted-foreground">Nenhum compartilhamento enviado para este card.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {actionShares.map((share: any) => {
                  const cfg = STATUS_CONFIG[share.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PENDING;
                  const Icon = cfg.icon;
                  return (
                    <div key={share.id} className="flex items-start gap-3 p-3 border rounded-lg bg-background">
                      <Avatar className="size-7 shrink-0">
                        <AvatarImage src={share.targetOrg?.logo || ""} />
                        <AvatarFallback className="text-[10px] font-bold">
                          {share.targetOrg?.name?.[0] ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{share.targetOrg?.name}</p>
                        {share.message && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">"{share.message}"</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {format(new Date(share.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("shrink-0 gap-1 text-[10px] px-1.5 py-0.5", cfg.color)}
                      >
                        <Icon className="size-2.5" />
                        {cfg.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
