"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useCommentsAutomations } from "@/features/comments/hooks/use-comments-automations";
import { useCreateCommentsKeyword } from "@/features/comments/hooks/use-comments-keyword";

type Automation = { id: string; name: string };

export default function CommentsKeywordsPage() {
  return (
    <CommentsShell
      title="Palavras-chave"
      description="Cadastre termos que ativam automações em comentários e DMs."
    >
      <CommentsConnectionGuard>
        <KeywordForm />
      </CommentsConnectionGuard>
    </CommentsShell>
  );
}

function KeywordForm() {
  const { data, isLoading } = useCommentsAutomations();
  const create = useCreateCommentsKeyword();

  const automations = (Array.isArray(data) ? data : []) as Automation[];

  const [automationId, setAutomationId] = useState("");
  const [keyword, setKeyword] = useState("");

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
            <KeyRound className="size-4" />
            Crie uma automação primeiro
          </CardTitle>
          <CardDescription>
            Palavras-chave pertencem a automações. Crie uma na aba Automações
            antes de cadastrar termos.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4" />
          Nova palavra-chave
        </CardTitle>
        <CardDescription>
          Quando o termo aparecer no comentário ou DM, a automação selecionada
          dispara.
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

        <div className="grid gap-2">
          <Label>Termo</Label>
          <Input
            placeholder="Ex: quero, sorteio, link"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => {
              if (!automationId) {
                toast.error("Selecione uma automação");
                return;
              }
              if (!keyword.trim()) {
                toast.error("Informe a palavra-chave");
                return;
              }
              create.mutate(
                { automationId, keyword: keyword.trim() },
                {
                  onSuccess: () => {
                    toast.success("Palavra-chave cadastrada");
                    setKeyword("");
                  },
                  onError: (err: { message?: string }) =>
                    toast.error(err?.message ?? "Falha ao cadastrar"),
                },
              );
            }}
            disabled={create.isPending}
          >
            {create.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Cadastrar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
