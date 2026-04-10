"use client";

import { useState } from "react";
import {
  Plus,
  Smartphone,
  Trash2,
  Unlink,
  MoreVertical,
  RefreshCw,
  Zap,
  Loader2,
  InfoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CreateInstanceModal } from "./create-instance-modal";
import { Instance } from "./types";
import { getInstanceStatus } from "@/http/uazapi/get-instance-status";
import { disconnectInstance } from "@/http/uazapi/disconnect-instance";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WhatsAppInstanceStatus } from "@/generated/prisma/enums";
import {
  useQueryInstances,
  useDisconnectIntegrationStatus,
} from "../hooks/use-integration";
import { useParams } from "next/navigation";
import { DeleteInstanceModal } from "./delet-instance-modal";
import { ConnectModal } from "./conect-instance-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Lock } from "lucide-react";

// ── Popup plano necessário ────────────────────────────────────────────────────
function NoPlanPopup({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-yellow-500/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <h3 className="text-base font-bold">Plano necessário</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Para conectar instâncias de WhatsApp é necessário ter um plano
              ativo. Fale com o administrador da plataforma para contratar um
              plano.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}

export function ChatSettings() {
  const baseUrl = process.env.NEXT_PUBLIC_UAZAPI_BASE_URL;
  const { trackingId } = useParams<{ trackingId: string }>();

  // Plan check
  const { data: balance } = useQuery({
    ...orpc.stars.getBalance.queryOptions(),
    staleTime: 60_000,
  });
  const hasPlan = balance
    ? balance.planSlug !== "free" && balance.planMonthlyStars > 0
    : true; // optimistic while loading
  const [showNoPlan, setShowNoPlan] = useState(false);

  const handleCreateClick = () => {
    // if (!hasPlan) {
    //   setShowNoPlan(true);
    //   return;
    // }
    setIsCreateOpen(true);
  };

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const disconnectIntegrationStatusMutation =
    useDisconnectIntegrationStatus(trackingId);

  // Selected Instance for modals
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(
    null,
  );

  const { instanceLoading, instance } = useQueryInstances(trackingId);

  const checkStatus = async (instance: Instance) => {
    try {
      const result = await getInstanceStatus(instance.apiKey);
      return result;
    } catch (error: any) {
      toast.error(`Erro ao verificar status: ${error.message}`);
    }
  };

  const handleDelete = async (instance: Instance) => {
    setIsDeleteOpen(true);
    setSelectedInstance(instance);
  };

  const handleDisconnect = async (instance: {
    token: string;
    serverUrl: string;
    instanceId: string;
  }) => {
    try {
      await disconnectInstance(
        instance.token,
        (instance as any).serverUrl || baseUrl,
      );
      disconnectIntegrationStatusMutation.mutate({
        instanceId: instance.instanceId,
        status: WhatsAppInstanceStatus.DISCONNECTED,
        token: instance.token,
        baseUrl: (instance as any).serverUrl || baseUrl,
      });
    } catch (error: any) {
      toast.error(`Erro ao desconectar: ${error.message}`);
    }
  };

  const onInstanceCreated = (instance: Instance) => {
    setIsCreateOpen(false);
    setIsConnectOpen(true);
    setSelectedInstance(instance);
  };

  const openConnect = (instance: Instance) => {
    setSelectedInstance(instance);
    setIsConnectOpen(true);
  };

  return (
    <div className="space-y-8 pb-10">
      <NoPlanPopup open={showNoPlan} onClose={() => setShowNoPlan(false)} />

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Zap className="size-4 " />
            <h2 className="text-xl font-semibold">Painel de Integrações</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Gerencie suas integrações e conexões via API.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button disabled={!!instance} onClick={handleCreateClick}>
            {!hasPlan && <Lock className="size-3.5" />}
            <Plus className="size-4" />
            Nova Instância
          </Button>
        </div>
      </div>

      {/* Settings Sidebar */}
      <Alert>
        <InfoIcon />
        <AlertTitle>Cada tracking só pode ter uma instância</AlertTitle>
        <AlertDescription>
          Se você já tem uma instância conectada, não é possível criar outra.
        </AlertDescription>
      </Alert>
      <div className="col-span-4 space-y-6">
        {instanceLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 rounded-3xl ">
            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            <p className="text-muted-foreground animate-pulse">
              Carregando suas instâncias...
            </p>
          </div>
        ) : !instance ? (
          <div className="flex flex-col items-center justify-center py-20  rounded-3xl   space-y-4">
            <div className="p-4 bg-background rounded-full shadow-inner">
              <Smartphone className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium">
                Nenhuma instância encontrada
              </h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                Adicione uma nova instância ou insira seu Admin Token para
                carregar as existentes.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleCreateClick}>
              {!hasPlan && <Lock className="size-3.5" />}
              Criar primeira instância
            </Button>
          </div>
        ) : (
          <div className="flex flex-col w-full">
            <div className="group overflow-hidden border-border/50 transition-all rounded-2xl  ">
              <div className="p-5">
                <div className="flex items-start">
                  <div className="space-y-3">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      {instance.instanceName}
                      <Badge
                        variant={
                          instance.status === WhatsAppInstanceStatus.CONNECTED
                            ? "default"
                            : "secondary"
                        }
                        className={cn(
                          "text-[10px] px-1.5 h-4 font-bold uppercase",
                          instance.status === WhatsAppInstanceStatus.CONNECTED
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {instance.status === WhatsAppInstanceStatus.CONNECTED
                          ? "Conectado"
                          : "Desconectado"}
                      </Badge>
                    </h2>
                    <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                      ID: {instance.id}
                    </CardDescription>
                  </div>
                  <div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => checkStatus(instance)}>
                          <RefreshCw className="size-4" />
                          Verificar Status
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />
                        {instance.status ===
                          WhatsAppInstanceStatus.CONNECTED && (
                          <DropdownMenuItem
                            onClick={() =>
                              handleDisconnect({
                                token: instance.apiKey,
                                serverUrl: instance.baseUrl,
                                instanceId: instance.instanceId,
                              })
                            }
                            className="text-warning"
                          >
                            <Unlink className="size-4" />
                            Desconectar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDelete(instance)}
                          className="text-destructive focus:bg-destructive/10"
                        >
                          <Trash2 className="size-4" />
                          Excluir Instância
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-3">
                    <div className="p-2 rounded-lg bg-muted/30 border border-border/30 mt-2">
                      <div>
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                          Telefone
                        </Label>
                        <p className="text-sm font-medium truncate">
                          {instance.phoneNumber || "---"}
                        </p>
                      </div>
                      <div className="mt-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                          Nome
                        </Label>
                        <p className="text-sm font-medium truncate">
                          {instance.profileName || "---"}
                        </p>
                      </div>
                      <div className="mt-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                          Whatsapp Business
                        </Label>
                        <p className="text-sm font-medium truncate">
                          {instance.isBusiness ? "Sim" : "Não"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => openConnect(instance)}
                    variant="outline"
                  >
                    <Smartphone className="size-4" />
                    {instance.status === WhatsAppInstanceStatus.CONNECTED
                      ? "Reconectar"
                      : "Conectar Agora"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateInstanceModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={onInstanceCreated}
        trackingId={trackingId}
      />

      {selectedInstance && (
        <>
          <ConnectModal
            open={isConnectOpen}
            onOpenChange={setIsConnectOpen}
            instance={selectedInstance}
            onCheckStatus={() => {
              checkStatus(selectedInstance);
            }}
            trackingId={trackingId}
          />

          <DeleteInstanceModal
            open={isDeleteOpen}
            onOpenChange={setIsDeleteOpen}
            data={{
              ...selectedInstance,
              instanceId: selectedInstance.instanceId,
              trackingId: trackingId,
            }}
          />
        </>
      )}
    </div>
  );
}
