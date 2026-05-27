"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { SendAppActionBaseDialog } from "../send-app-actions/base-dialog";
import { ResourceSelect } from "../send-app-actions/resource-select";
import { orpc } from "@/lib/orpc";
import type { SendNasaRouteData } from "./executor";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: SendNasaRouteData;
  onSubmit: (values: SendNasaRouteData) => void;
}

const DEFAULT_MSG =
  "Olá {{nome}}, sua matrícula no curso {{curso_nome}} ({{curso_preco}}) — {{checkout_ou_acesso}}: {{url}}";

export function SendNasaRouteDialog({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
}: Props) {
  const [courseId, setCourseId] = useState(defaultValues?.courseId ?? "");
  const [messageTemplate, setMessageTemplate] = useState(
    defaultValues?.messageTemplate ?? "",
  );

  useEffect(() => {
    if (open) {
      setCourseId(defaultValues?.courseId ?? "");
      setMessageTemplate(defaultValues?.messageTemplate ?? "");
    }
  }, [open, defaultValues]);

  return (
    <SendAppActionBaseDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Enviar Curso NASA Route"
      description="Envia link do curso pro lead. Cursos pagos abrem checkout Stripe."
      messageTemplate={messageTemplate}
      onMessageTemplateChange={setMessageTemplate}
      defaultMessagePreview={DEFAULT_MSG}
      extraVariables={[
        "{{curso_nome}}",
        "{{curso_preco}}",
        "{{checkout_ou_acesso}}",
      ]}
      canSubmit={courseId.trim().length > 0}
      onSubmit={() =>
        onSubmit({
          courseId: courseId.trim(),
          messageTemplate: messageTemplate.trim() || undefined,
        })
      }
    >
      <div className="space-y-2">
        <Label htmlFor="courseId">Curso</Label>
        <ResourceSelect
          queryOptions={orpc.nasaRoute.creatorListCourses.queryOptions({
            input: {},
          })}
          getItems={(d: any) => d?.courses ?? []}
          getId={(it: any) => it.id}
          getLabel={(it: any) =>
            `${it.title}${(it.priceStars ?? 0) === 0 ? " (grátis)" : ` (${it.priceStars} ⭐)`}`
          }
          value={courseId}
          onValueChange={setCourseId}
          placeholder="Selecione um curso"
          emptyMessage="Nenhum curso publicado encontrado."
        />
        <p className="text-[10px] text-muted-foreground">
          Cursos pagos: lead vê o checkout Stripe ao abrir o link. Cursos
          gratuitos: acesso direto após login.
        </p>
      </div>
    </SendAppActionBaseDialog>
  );
}
