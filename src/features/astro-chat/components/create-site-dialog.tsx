"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateAstroChatSite } from "../hooks/use-astro-chat-sites";
import { SiteFormFields } from "./site-form-fields";
import { EMPTY_SITE_FORM, toSitePayload, type SiteFormValues } from "./site-form-values";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { emitTourResult } from "@/features/tour/store";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";

/** Cadastro de site: o essencial para o widget ir ao ar (spec 0031, RF-2). */
export function CreateSiteDialog({
  open,
  onOpenChange,
  monthlyPrice,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthlyPrice: number;
  onCreated: (siteId: string) => void;
}) {
  const [values, setValues] = useState<SiteFormValues>(EMPTY_SITE_FORM);
  const createSite = useCreateAstroChatSite();
  const isValid = values.name.trim().length >= 2 && !!values.trackingId && values.allowedOrigins.length > 0;

  const submit = () => {
    createSite.mutate(toSitePayload(values), {
      onSuccess: (created) => {
        emitTourResult({ kind: GUIDE_RESULT_KINDS.astroChatSiteCreated });
        if (created.isCharged) {
          toast.success(
            created.price > 0 ? `Site criado. ${created.price} Stars debitados pelo 1º mês.` : "Site criado.",
          );
        } else {
          toast.warning(`Site criado, mas pausado: faltam Stars para a mensalidade (${created.price}).`);
        }
        setValues(EMPTY_SITE_FORM);
        onOpenChange(false);
        onCreated(created.id);
      },
      onError: (error) => toast.error(error.message || "Não foi possível criar o site."),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        data-guide={GUIDE_ANCHORS.astroChatSiteDialog.id}
      >
        <DialogHeader>
          <DialogTitle>Adicionar site</DialogTitle>
          <DialogDescription>
            O ASTRO passa a atender no site e cada conversa chega no Chat. Mensalidade de{" "}
            <strong>{monthlyPrice} Stars</strong> por site, cobrada agora e a cada mês.
          </DialogDescription>
        </DialogHeader>
        <SiteFormFields
          values={values}
          onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
          sections={["basics"]}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={!isValid || createSite.isPending}
            data-guide={GUIDE_ANCHORS.astroChatSiteSubmit.id}
          >
            {createSite.isPending ? "Criando…" : "Criar e ativar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
