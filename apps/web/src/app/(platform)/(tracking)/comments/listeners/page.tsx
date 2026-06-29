"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Headphones, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommentsShell } from "@/features/comments/components/comments-shell";
import { CommentsConnectionGuard } from "@/features/comments/components/connection-guard";
import {
  useCreateCommentsListener,
  useUpdateCommentsListener,
} from "@/features/comments/hooks/use-comments-listener";
import { useCommentsAutomations } from "@/features/comments/hooks/use-comments-automations";

type Automation = { id: string; name: string };
type ListenerKind = "SMARTAI" | "MESSAGE";

export default function CommentsListenersPage() {
  return (
    <CommentsShell
      title="Listeners"
      description="Defina como cada automação interpreta e responde mensagens."
    >
      <CommentsConnectionGuard>
        <ListenerForm />
      </CommentsConnectionGuard>
    </CommentsShell>
  );
}

function ListenerForm() {
  const { data, isLoading } = useCommentsAutomations();
  const create = useCreateCommentsListener();
  const update = useUpdateCommentsListener();

  const automations = (Array.isArray(data) ? data : []) as Automation[];

  const [automationId, setAutomationId] = useState<string>("");
  const [listener, setListener] = useState<ListenerKind>("MESSAGE");
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState("");
  const [mode, setMode] = useState<"create" | "update">("create");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        Carregando automações…
      </div>
    );
  }

  if (!automations.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Headphones className="size-4" />
            Crie uma automação primeiro
          </CardTitle>
          <CardDescription>
            Listeners pertencem a automações. Crie uma na aba Automações antes
            de configurar.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const submit = () => {
    if (!automationId) {
      toast.error("Selecione uma automação");
      return;
    }
    const payload = { automationId, listener, prompt, reply };
    const opts = {
      onSuccess: () => toast.success("Listener salvo"),
      onError: (err: { message?: string }) =>
        toast.error(err?.message ?? "Falha ao salvar"),
    };
    if (mode === "create") create.mutate(payload, opts);
    else update.mutate(payload, opts);
  };

  const pending = create.isPending || update.isPending;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Headphones className="size-4" />
          Configurar listener
        </CardTitle>
        <CardDescription>
          Use SMARTAI para respostas geradas por IA com base no prompt, ou
          MESSAGE para enviar exatamente o texto definido em &quot;Resposta&quot;.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Automação</Label>
          <Select value={automationId} onValueChange={setAutomationId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha uma automação" />
            </SelectTrigger>
            <SelectContent>
              {automations.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <Select
              value={listener}
              onValueChange={(v) => setListener(v as ListenerKind)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MESSAGE">MESSAGE (resposta fixa)</SelectItem>
                <SelectItem value="SMARTAI">SMARTAI (IA)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Modo</Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as "create" | "update")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create">Criar listener</SelectItem>
                <SelectItem value="update">Atualizar existente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Prompt</Label>
          <Textarea
            placeholder="Instruções da IA ou contexto da resposta"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label>Resposta (opcional)</Label>
          <Input
            placeholder="Texto a enviar quando tipo for MESSAGE"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={pending}>
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Salvar listener
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
