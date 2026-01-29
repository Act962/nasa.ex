"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Settings2,
  Smartphone,
  Trash2,
  Unlink,
  Search,
  MoreVertical,
  RefreshCw,
  Globe,
  Key,
  ShieldCheck,
  Zap,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CreateInstanceModal } from "./create-instance-modal";
import { ConnectModal } from "./connect-instance-modal";
import { WebhookModal } from "./webhook-modal";
import { Instance } from "./types";
import { listInstances } from "@/http/uazapi/admin/list-instances";
import { getInstanceStatus } from "@/http/uazapi/get-instance-status";
import { deleteInstance } from "@/http/uazapi/delete-instance";
import { disconnectInstance } from "@/http/uazapi/disconnect-instance";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WhatsAppInstanceStatus } from "@/generated/prisma/enums";
export function ChatSettings() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminToken, setAdminToken] = useState("");
  const baseUrl = process.env.NEXT_PUBLIC_UAZAPI_BASE_URL;

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isWebhookOpen, setIsWebhookOpen] = useState(false);

  // Selected Instance for modals
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(
    null,
  );

  const fetchInstances = async () => {
    if (!adminToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await listInstances(adminToken, baseUrl);
      // Uazapi returns an array of instances for listInstances
      setInstances(data as any as Instance[]);
    } catch (error: any) {
      toast.error("Erro ao carregar instâncias: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async (instance: Instance) => {
    try {
      const result = await getInstanceStatus(
        instance.token,
        (instance as any).serverUrl || baseUrl,
      );

      setInstances((prev) =>
        prev.map((inst) =>
          inst.id === instance.id
            ? {
                ...inst,
                status: result.status.connected
                  ? WhatsAppInstanceStatus.CONNECTED
                  : WhatsAppInstanceStatus.DISCONNECTED,
              }
            : inst,
        ),
      );

      toast.success(`Status de ${instance.name} atualizado`);
    } catch (error: any) {
      toast.error(`Erro ao verificar status: ${error.message}`);
    }
  };

  const handleDelete = async (instance: Instance) => {
    if (
      !confirm(`Tem certeza que deseja excluir a instância ${instance.name}?`)
    )
      return;

    try {
      await deleteInstance(
        instance.token,
        (instance as any).serverUrl || baseUrl,
      );
      setInstances((prev) => prev.filter((inst) => inst.id !== instance.id));
      toast.success("Instância excluída com sucesso");
    } catch (error: any) {
      toast.error(`Erro ao excluir: ${error.message}`);
    }
  };

  const handleDisconnect = async (instance: Instance) => {
    try {
      await disconnectInstance(
        instance.token,
        (instance as any).serverUrl || baseUrl,
      );
      setInstances((prev) =>
        prev.map((inst) =>
          inst.id === instance.id
            ? { ...inst, status: WhatsAppInstanceStatus.DISCONNECTED }
            : inst,
        ),
      );
      toast.success("Instância desconectada");
    } catch (error: any) {
      toast.error(`Erro ao desconectar: ${error.message}`);
    }
  };

  const onInstanceCreated = (instance: Instance) => {
    setInstances((prev) => [...prev, instance]);
    setIsCreateOpen(false);
  };

  const openConnect = (instance: Instance) => {
    setSelectedInstance(instance);
    setIsConnectOpen(true);
  };

  const openWebhook = (instance: Instance) => {
    setSelectedInstance(instance);
    setIsWebhookOpen(true);
  };

  useEffect(() => {
    if (adminToken) {
      fetchInstances();
    } else {
      setLoading(false);
    }
  }, [adminToken]);

  return (
    <div className="space-y-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 rounded-2xl backdrop-blur-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-primary animate-pulse" />
            <h2 className="text-xl font-semibold">Painel de Integrações</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Gerencie suas integrações e conexões via API.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="size-4" />
            Nova Instância
          </Button>
          <Button
            variant="outline"
            onClick={fetchInstances}
            disabled={loading && !!adminToken}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Settings Sidebar */}
      <div className="col-span-4 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 rounded-3xl ">
            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            <p className="text-muted-foreground animate-pulse">
              Carregando suas instâncias...
            </p>
          </div>
        ) : instances.length === 0 ? (
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {instances.map((instance) => (
              <div
                key={instance.id}
                className="group overflow-hidden border-border/50 hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-primary/5 bg-card/50 rounded-2xl  "
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3">
                      <h2 className="text-lg flex items-center gap-2">
                        {instance.name}
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => checkStatus(instance)}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Verificar Status
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openWebhook(instance)}
                          >
                            <Globe className="h-4 w-4 mr-2" />
                            Webhooks
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {instance.status ===
                            WhatsAppInstanceStatus.CONNECTED && (
                            <DropdownMenuItem
                              onClick={() => handleDisconnect(instance)}
                              className="text-warning"
                            >
                              <Unlink className="h-4 w-4 mr-2" />
                              Desconectar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDelete(instance)}
                            className="text-destructive focus:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir Instância
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="p-5 pt-0 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2 rounded-lg bg-muted/30 border border-border/30">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                          Telefone
                        </Label>
                        <p className="text-sm font-medium truncate">
                          {instance.phone || "---"}
                        </p>
                      </div>
                    </div>

                    <Button
                      onClick={() => openConnect(instance)}
                      className="w-full h-9 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border-primary/20 transition-all font-semibold"
                      variant="outline"
                    >
                      <Smartphone className="h-4 w-4 mr-2" />
                      {instance.status === WhatsAppInstanceStatus.CONNECTED
                        ? "Reconectar"
                        : "Conectar Agora"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateInstanceModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={onInstanceCreated}
        adminToken={adminToken}
        baseUrl={baseUrl}
      />

      {selectedInstance && (
        <>
          <ConnectModal
            open={isConnectOpen}
            onOpenChange={setIsConnectOpen}
            instance={selectedInstance}
            onConnected={() => {
              checkStatus(selectedInstance);
              setIsConnectOpen(false);
            }}
          />
          <WebhookModal
            open={isWebhookOpen}
            onOpenChange={setIsWebhookOpen}
            instance={selectedInstance}
          />
        </>
      )}
    </div>
  );
}
