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

export function ChatSettings() {
  const baseUrl = process.env.NEXT_PUBLIC_UAZAPI_BASE_URL;
  const { trackingId } = useParams<{ trackingId: string }>();

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
          <Button disabled={!!instance} onClick={() => setIsCreateOpen(true)}>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
            >
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
