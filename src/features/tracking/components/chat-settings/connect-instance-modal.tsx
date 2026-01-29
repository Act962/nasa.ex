"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, QrCode, Smartphone, Copy, Check } from "lucide-react";
import { Instance } from "./types";
import { connectInstance } from "@/http/uazapi/connect-instance";
import { getInstanceStatus } from "@/http/uazapi/get-instance-status";
import { Spinner } from "@/components/ui/spinner";
import { InstanceStatusResponse } from "@/http/uazapi/types";

interface ConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: Instance;
  onConnected: () => void;
}

export function ConnectModal({
  open,
  onOpenChange,
  instance,
  onConnected,
}: ConnectModalProps) {
  const [phone, setPhone] = useState("");
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const result = await getInstanceStatus(instance.token, instance.baseUrl);
      if (result.status.connected) {
        setIsConnected(true);
        onConnected();
      }
    } catch (err) {
      console.error("Erro ao verificar status:", err);
    }
  }, [instance.token, instance.baseUrl, onConnected]);

  const generateQRCode = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await connectInstance(
        instance.token,
        undefined,
        instance.baseUrl,
      );

      if (result.connected) {
        setIsConnected(true);
        onConnected();
        return;
      }

      if (result.instance.qrcode) {
        setQrcode(result.instance.qrcode);
        setPairingCode(null);
        setLastUpdate(new Date());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar QR Code");
    } finally {
      setLoading(false);
    }
  }, [instance.token, instance.baseUrl, onConnected]);

  const generatePairingCode = async () => {
    if (!phone) return;

    setLoading(true);
    setError(null);

    try {
      const result = await connectInstance(
        instance.token,
        phone,
        instance.baseUrl,
      );

      if (result.connected) {
        setIsConnected(true);
        onConnected();
        return;
      }

      if (result.pairingCode) {
        setPairingCode(result.pairingCode);
        setQrcode(null);
        setLastUpdate(new Date());
      } else if (result.qrcode) {
        setQrcode(result.qrcode);
        setPairingCode(null);
        setLastUpdate(new Date());
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao gerar codigo de pareamento",
      );
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    if (open && !qrcode && !pairingCode && !loading && !isConnected) {
      generateQRCode();
    }
  }, [open]);

  // Poll status while open
  useEffect(() => {
    if (!open || isConnected) return;

    const interval = setInterval(checkStatus, 5000);

    return () => clearInterval(interval);
  }, [open, isConnected, checkStatus]);

  const twoMinutes = 2 * 60 * 1000;

  useEffect(() => {
    if (!open || !qrcode || isConnected) return;

    const interval = setInterval(() => {
      generateQRCode();
    }, twoMinutes);

    return () => clearInterval(interval);
  }, [open, qrcode, generateQRCode, isConnected]);

  useEffect(() => {
    if (!open) {
      setQrcode(null);
      setPairingCode(null);
      setError(null);
      setPhone("");
      setLastUpdate(null);
      setIsConnected(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl">Conectar</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {isConnected ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="size-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
                <Check className="size-10 text-emerald-500" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold">
                  Conectado com sucesso!
                </h3>
                <p className="text-sm text-muted-foreground">
                  Sua instância do WhatsApp está ativa e pronta para uso.
                </p>
              </div>
              <Button onClick={() => onOpenChange(false)} className="w-full">
                Fechar
              </Button>
            </div>
          ) : (
            <>
              {/* QR Code Display */}
              <div className="flex flex-col items-center space-y-3">
                {loading && !qrcode && !pairingCode ? (
                  <div className="w-64 h-64 flex items-center justify-center bg-muted/50 rounded-lg border border-border/50">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  </div>
                ) : qrcode ? (
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <img
                      src={qrcode || "/placeholder.svg"}
                      alt="QR Code para conectar WhatsApp"
                      className="w-60 h-60"
                    />
                  </div>
                ) : pairingCode ? (
                  <div className="w-64 flex flex-col items-center justify-center bg-muted/50 rounded-lg border border-border/50 p-6">
                    <p className="text-xs text-muted-foreground mb-2">
                      Codigo de Pareamento:
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

              {/* Action Buttons */}
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
                    <span className="bg-card px-3 text-muted-foreground">
                      ou
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">
                    Numero do telefone (com DDD e codigo do pais)
                  </Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="5511999999999"
                    disabled={loading}
                    className="h-11 bg-input/50"
                  />
                </div>

                <Button
                  onClick={generatePairingCode}
                  disabled={loading || !phone}
                  variant="outline"
                  className="w-full h-11 bg-transparent"
                >
                  {loading && pairingCode === null && phone && <Spinner />}
                  Gerar Codigo de Pareamento
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
