"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, QrCode, Copy, Check, ChevronDownIcon } from "lucide-react";
import { Instance } from "./types";
import { connectInstance } from "@/http/uazapi/connect-instance";
import { getInstanceStatus } from "@/http/uazapi/get-instance-status";
import { Spinner } from "@/components/ui/spinner";
import { useConnectIntegrationStatus } from "../hooks/use-integration";
import { WhatsAppInstanceStatus } from "@/generated/prisma/enums";
import { normalizePhone, phoneMask } from "@/utils/format-phone";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { countries } from "@/types/some";

interface ConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: Instance;
  onCheckStatus: () => void;
  trackingId: string;
}

export function ConnectModal({
  open,
  onOpenChange,
  instance,
  onCheckStatus,
  trackingId,
}: ConnectModalProps) {
  // --- States ---
  const [phone, setPhone] = useState("");
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const [isConnected, setIsConnected] = useState(
    instance.status === WhatsAppInstanceStatus.CONNECTED,
  );

  const hasGeneratedQRCode = useRef(false);
  const connectIntegrationStatusMutation =
    useConnectIntegrationStatus(trackingId);

  const handleUpdateStatus = useCallback(
    ({
      profileName,
      profilePicUrl,
      owner,
      isBusiness,
    }: {
      profileName?: string;
      profilePicUrl?: string;
      owner?: string;
      isBusiness?: boolean;
    }) => {
      if (instance.status !== WhatsAppInstanceStatus.CONNECTED) {
        connectIntegrationStatusMutation.mutate({
          profileName: profileName || "",
          profilePicUrl: profilePicUrl || "",
          instanceId: instance.instanceId,
          owner: owner || "",
          token: instance.apiKey,
          baseUrl: instance.baseUrl,
          status: WhatsAppInstanceStatus.CONNECTED,
          trackingId,
          isBusiness: isBusiness,
        });
      }
      setIsConnected(true);
      onCheckStatus();
    },
    [
      instance.instanceId,
      instance.status,
      instance.apiKey,
      instance.baseUrl,
      connectIntegrationStatusMutation,
      onCheckStatus,
      trackingId,
    ],
  );

  const checkStatus = useCallback(async () => {
    try {
      const result = await getInstanceStatus(instance.apiKey);
      if (result.status.connected) {
        handleUpdateStatus({
          profileName: result.instance.profileName,
          profilePicUrl: result.instance.profilePicUrl,
          owner: result.instance.owner,
          isBusiness: result.instance.isBusiness,
        });
      }
    } catch (err) {
      console.error("Erro ao verificar status:", err);
    }
  }, [instance.apiKey, handleUpdateStatus]);

  const generateQRCode = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await connectInstance(
        instance.apiKey,
        undefined,
        instance.baseUrl,
      );

      if (result.connected) {
        handleUpdateStatus({
          profileName: result.instance.profileName,
          profilePicUrl: result.instance.profilePicUrl,
          owner: result.instance.owner,
          isBusiness: result.instance.isBusiness,
        });
        return;
      }

      if (result.instance.qrcode) {
        setQrcode(result.instance.qrcode);
        setPairingCode(null);
        setLastUpdate(new Date());
        hasGeneratedQRCode.current = true;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar QR Code");
    } finally {
      setLoading(false);
    }
  }, [instance.apiKey, instance.baseUrl, handleUpdateStatus]);

  const generatePairingCode = useCallback(async () => {
    if (!phone) return;

    const normalizedPhone = normalizePhone(
      [selectedCountry.ddi, phone].join(""),
    );

    setLoading(true);
    setError(null);

    try {
      const result = await connectInstance(
        instance.apiKey,
        normalizedPhone,
        instance.baseUrl,
      );

      if (result.connected) {
        handleUpdateStatus({
          profileName: result.instance.profileName,
          profilePicUrl: result.instance.profilePicUrl,
          owner: result.instance.owner,
          isBusiness: result.instance.isBusiness,
        });
        return;
      }

      if (result.instance?.paircode) {
        setPairingCode(result.instance.paircode);
        setQrcode(null);
        setLastUpdate(new Date());
      } else if (result.instance?.qrcode) {
        setQrcode(result.instance.qrcode);
        setPairingCode(null);
        setLastUpdate(new Date());
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao gerar código de pareamento",
      );
    } finally {
      setLoading(false);
    }
  }, [
    phone,
    selectedCountry.ddi,
    instance.apiKey,
    instance.baseUrl,
    handleUpdateStatus,
  ]);

  const copyPairingCode = async () => {
    if (!pairingCode) return;
    await navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Gera QR Code automaticamente apenas na primeira vez que o modal abre
  useEffect(() => {
    if (open && !hasGeneratedQRCode.current && !isConnected) {
      generateQRCode();
    }
  }, [open, generateQRCode, isConnected]);

  // Polling para verificar status a cada 5 segundos
  useEffect(() => {
    if (!open || isConnected) return;
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [open, isConnected, checkStatus]);

  // Atualiza QR Code a cada 2 minutos
  useEffect(() => {
    if (!open || !qrcode || isConnected) return;

    const twoMinutes = 2 * 60 * 1000;
    const interval = setInterval(() => {
      generateQRCode();
    }, twoMinutes);

    return () => clearInterval(interval);
  }, [open, qrcode, generateQRCode, isConnected]);

  // Limpeza de estado ao fechar
  useEffect(() => {
    if (open) {
      setIsConnected(instance.status === WhatsAppInstanceStatus.CONNECTED);
    } else {
      setQrcode(null);
      setPairingCode(null);
      setError(null);
      setPhone("");
      setLastUpdate(null);
      setIsConnected(false);
      hasGeneratedQRCode.current = false;
    }
  }, [open, instance.status]);

  // --- Render Views ---

  const renderConnectedView = () => (
    <div className="flex flex-col items-center justify-center py-10 space-y-4">
      <div className="size-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
        <Check className="size-10 text-emerald-500" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold">Conectado com sucesso!</h3>
        <p className="text-sm text-muted-foreground">
          Sua instância do WhatsApp está ativa e pronta para uso.
        </p>
      </div>
      <Button onClick={() => onOpenChange(false)} className="w-full">
        Fechar
      </Button>
    </div>
  );

  const renderConnectionMethodView = () => (
    <>
      {/* QR Code / Pairing Code Area */}
      <div className="flex flex-col items-center space-y-3">
        {loading && !qrcode && !pairingCode ? (
          <div className="w-64 h-64 flex items-center justify-center bg-muted/50 rounded-lg border border-border/50">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : qrcode ? (
          <div className="bg-white p-3 rounded-lg shadow-sm">
            <img
              src={qrcode}
              alt="QR Code para conectar WhatsApp"
              className="w-60 h-60"
            />
          </div>
        ) : pairingCode ? (
          <div className="w-64 flex flex-col items-center justify-center bg-muted/50 rounded-lg border border-border/50 p-6">
            <p className="text-xs text-muted-foreground mb-2">
              Código de Pareamento:
            </p>
            <p className="text-2xl font-mono font-bold tracking-widest text-foreground">
              {pairingCode}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyPairingCode}
              className="mt-3 gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="w-64 h-64 flex items-center justify-center bg-muted/50 rounded-lg border border-border/50">
            <QrCode className="h-16 w-16 text-muted-foreground/50" />
          </div>
        )}

        {lastUpdate && (
          <p className="text-sm text-muted-foreground">
            Atualizado: {formatTime(lastUpdate)}
          </p>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <Button
          onClick={generateQRCode}
          disabled={loading}
          className="w-full h-11"
        >
          {loading && qrcode === null && pairingCode === null ? (
            <Spinner />
          ) : (
            <QrCode className="h-4 w-4 mr-2" />
          )}
          Gerar QR Code
        </Button>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/50" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-3 text-muted-foreground">ou</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium">
            Número do telefone (com DDD e código do país)
          </Label>

          <InputGroup>
            <InputGroupAddon align="inline-start">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <InputGroupButton variant="ghost" className="pr-1.5! text-xs">
                    <img
                      src={selectedCountry.flag}
                      alt={selectedCountry.country}
                      className="w-5 h-4 rounded-sm"
                    />
                    <span>{selectedCountry.ddi}</span>
                    <ChevronDownIcon className="size-3" />
                  </InputGroupButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="[--radius:0.95rem] max-h-30 overflow-y-auto"
                >
                  <DropdownMenuGroup>
                    {countries.map((country) => (
                      <DropdownMenuItem
                        key={country.code}
                        onClick={() => setSelectedCountry(country)}
                      >
                        <img
                          src={country.flag}
                          alt={country.country}
                          className="w-5 h-4 rounded-sm"
                        />
                        <span>{country.ddi}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </InputGroupAddon>
            <InputGroupInput
              value={phoneMask(phone)}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </InputGroup>
        </div>

        <Button
          onClick={generatePairingCode}
          disabled={loading || !phone}
          variant="outline"
          className="w-full h-11 bg-transparent"
        >
          {loading && pairingCode === null && phone ? <Spinner /> : null}
          Gerar Código de Pareamento
        </Button>
      </div>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl">Conectar Instância</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {isConnected ? renderConnectedView() : renderConnectionMethodView()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
