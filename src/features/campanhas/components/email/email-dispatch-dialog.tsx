"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateEmailCampaign,
  useEmailAudienceSummary,
  useEmailTemplates,
} from "../../hooks/use-email-campaigns";

// Spec 0107 (RF-2): disparo de email para os contatos marcados em /contatos.

export function EmailDispatchDialog({
  open,
  onOpenChange,
  leadIds,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadIds: string[];
  onSent: () => void;
}) {
  const templatesQuery = useEmailTemplates();
  const summaryQuery = useEmailAudienceSummary(leadIds, open);
  const createCampaign = useCreateEmailCampaign();
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");

  const templates = templatesQuery.data?.templates ?? [];
  const summary = summaryQuery.data;
  const canSend = !!name.trim() && !!templateId && (summary?.withEmail ?? 0) > 0;

  const handleSend = () => {
    createCampaign.mutate(
      { name: name.trim(), templateId, leadIds },
      {
        onSuccess: ({ totalRecipients }) => {
          toast.success(`Envio iniciado para ${totalRecipients} contato(s).`);
          setName("");
          setTemplateId("");
          onOpenChange(false);
          onSent();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-5 text-primary" />
            Disparar email
          </DialogTitle>
          <DialogDescription>
            Cada contato que receber ganha a tag &quot;Email: nome da campanha&quot;. Nenhum fluxo é disparado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome da campanha</Label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Resgate inadimplentes outubro"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Modelo de email</Label>
            {templates.length === 0 && !templatesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">
                Nenhum modelo ainda.{" "}
                <Link href="/campanhas/email-templates" className="text-primary underline">
                  Criar modelo de email
                </Link>
              </p>
            ) : (
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha o modelo" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="rounded-xl bg-muted/40 p-3 text-sm">
            {summaryQuery.isLoading || !summary ? (
              <OrbitaSpinner className="size-4" />
            ) : (
              <ul className="space-y-0.5">
                <li>
                  <strong>{summary.withEmail}</strong> vão receber
                </li>
                {summary.withoutEmail > 0 && (
                  <li className="text-muted-foreground">{summary.withoutEmail} sem email cadastrado</li>
                )}
                {summary.unsubscribed > 0 && (
                  <li className="text-muted-foreground">{summary.unsubscribed} pediram para não receber</li>
                )}
                {summary.duplicates > 0 && (
                  <li className="text-muted-foreground">{summary.duplicates} com email repetido (recebem uma vez)</li>
                )}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={!canSend || createCampaign.isPending} className="gap-1.5">
            {createCampaign.isPending && <OrbitaSpinner className="size-4" />}
            Enviar email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
