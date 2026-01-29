"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Instance, WebhookPayload } from "./types";
import { WebhookEvent } from "@/http/uazapi/types";
import { configureWebhook } from "@/http/uazapi/configure-webhook";

interface WebhookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: Instance;
}

const EVENTS: { id: WebhookEvent; label: string }[] = [
  { id: "connection", label: "Conexão" },
  { id: "messages", label: "Mensagens" },
  { id: "messages_update", label: "Status de Mensagem" },
  { id: "presence", label: "Presença" },
  { id: "leads", label: "Leads" },
  { id: "chats", label: "Conversas" },
];

export function WebhookModal({
  open,
  onOpenChange,
  instance,
}: WebhookModalProps) {
  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [events, setEvents] = useState<WebhookEvent[]>([
    "messages",
    "connection",
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const toggleEvent = (eventId: WebhookEvent) => {
    setEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((e) => e !== eventId)
        : [...prev, eventId],
    );
  };

  //   const handleSubmit = async (e: React.FormEvent) => {
  //     e.preventDefault();
  //     setLoading(true);
  //     setError(null);
  //     setSuccess(null);

  //     try {
  //       await configureWebhook(
  //         instance.token,
  //         {
  //           url,
  //           enabled,
  //           events,
  //         } as any,
  //         instance.serverUrl,
  //       );

  //       setSuccess("Webhook configurado com sucesso!");
  //       setTimeout(() => {
  //         onOpenChange(false);
  //         setSuccess(null);
  //       }, 2000);
  //     } catch (err: any) {
  //       setError(err.message || "Erro ao configurar webhook");
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl">Configurar Webhook</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center py-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            <p className="text-center text-foreground">{success}</p>
          </div>
        ) : (
          <form onSubmit={() => {}} className="space-y-5 pt-2">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="webhook-url" className="text-sm font-medium">
                URL do Webhook
              </Label>
              <Input
                id="webhook-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://seu-servidor.com/webhook"
                required
                disabled={loading}
                className="h-11 bg-input/50"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="webhook-enabled"
                checked={enabled}
                onCheckedChange={(checked) => setEnabled(!!checked)}
                disabled={loading}
              />
              <Label
                htmlFor="webhook-enabled"
                className="text-sm cursor-pointer"
              >
                Ativar Webhook
              </Label>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Eventos</Label>
              <div className="grid grid-cols-2 gap-3">
                {EVENTS.map((event) => (
                  <div key={event.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`event-${event.id}`}
                      checked={events.includes(event.id)}
                      onCheckedChange={() => toggleEvent(event.id)}
                      disabled={loading}
                    />
                    <Label
                      htmlFor={`event-${event.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {event.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-medium"
              disabled={loading || !url}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Configuração
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
