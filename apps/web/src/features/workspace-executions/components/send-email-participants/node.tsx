"use client";

import { MailIcon } from "lucide-react";
import { Node, NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useRef, useState } from "react";
import { Controller, useForm, FormProvider } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { WS_SEND_EMAIL_CHANNEL_NAME } from "@/inngest/channels/workspace";
import { useNodeStatus } from "@/features/tracking-executions/hook/use-node-status";
import { fetchWsSendEmailToken } from "../../lib/realtime-tokens";
import { workspaceVariables } from "../../lib/render-variables";
import { WsBaseExecutionNode } from "../base-execution-node";

type FormValues = {
  subject: string;
  body: string;
};

type FieldName = keyof FormValues;

const VARIABLE_ENTRIES = Object.entries(workspaceVariables) as [
  string,
  string,
][];

function VariableChips({
  onInsert,
}: {
  onInsert: (token: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {VARIABLE_ENTRIES.map(([token, label]) => (
        <button
          key={token}
          type="button"
          onClick={() => onInsert(token)}
          title={`Inserir ${token}`}
          className="text-xs rounded-md border border-border bg-muted/50 hover:bg-muted px-2 py-1 transition-colors"
        >
          <span className="font-medium">{label}</span>
          <span className="ml-1 text-muted-foreground font-mono">{token}</span>
        </button>
      ))}
    </div>
  );
}

function EmailDialog({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultValues?: Partial<FormValues>;
  onSubmit: (v: FormValues) => void;
}) {
  const form = useForm<FormValues>({
    defaultValues: { subject: "", body: "", ...defaultValues },
  });

  const subjectRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeField, setActiveField] = useState<FieldName>("body");

  const insertVariable = (token: string) => {
    const target = activeField;
    const el = target === "subject" ? subjectRef.current : bodyRef.current;
    const current = form.getValues(target) ?? "";
    let next: string;
    let cursor: number;

    if (el && typeof el.selectionStart === "number") {
      const start = el.selectionStart ?? current.length;
      const end = el.selectionEnd ?? current.length;
      next = current.slice(0, start) + token + current.slice(end);
      cursor = start + token.length;
    } else {
      next = current + token;
      cursor = next.length;
    }

    form.setValue(target, next, { shouldDirty: true });
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        try {
          el.setSelectionRange(cursor, cursor);
        } catch {}
      }
    });
  };

  const handle = (v: FormValues) => {
    onSubmit(v);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar email aos participantes</DialogTitle>
          <DialogDescription>
            Configure o assunto e o corpo do email. Use as variáveis abaixo
            para personalizar com dados da ação.
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(handle)} className="space-y-4">
            <FieldGroup>
              <Controller
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Assunto</FieldLabel>
                    <Input
                      {...field}
                      ref={(el) => {
                        field.ref(el);
                        subjectRef.current = el;
                      }}
                      value={field.value ?? ""}
                      placeholder="Ex.: Nova tarefa: {{action.title}}"
                      onFocus={() => setActiveField("subject")}
                    />
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="body"
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Corpo</FieldLabel>
                    <Textarea
                      {...field}
                      ref={(el) => {
                        field.ref(el);
                        bodyRef.current = el;
                      }}
                      value={field.value ?? ""}
                      rows={8}
                      placeholder={`Olá {{participant.name}},\n\nA ação "{{action.title}}" foi atribuída no workspace {{workspace.name}}.`}
                      onFocus={() => setActiveField("body")}
                    />
                  </Field>
                )}
              />
            </FieldGroup>

            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Variáveis disponíveis
                </span>
                <span className="text-xs text-muted-foreground">
                  Inserir em:{" "}
                  <span className="font-medium text-foreground">
                    {activeField === "subject" ? "Assunto" : "Corpo"}
                  </span>
                </span>
              </div>
              <VariableChips onInsert={insertVariable} />
              <p className="text-xs text-muted-foreground">
                Clique em uma variável para inserir na posição do cursor.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

export const WsSendEmailParticipantsNode = memo(
  (props: NodeProps<Node<{ action?: FormValues }>>) => {
    const [open, setOpen] = useState(false);
    const { setNodes } = useReactFlow();
    const status = useNodeStatus({
      nodeId: props.id,
      channel: WS_SEND_EMAIL_CHANNEL_NAME,
      topic: "status",
      refreshToken: fetchWsSendEmailToken as any,
    });

    const handleSubmit = (v: FormValues) =>
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === props.id
            ? { ...n, data: { ...(n.data as any), action: v } }
            : n,
        ),
      );

    const cfg = props.data?.action;
    const description = cfg?.subject
      ? `Assunto: ${cfg.subject}`
      : "Envia email aos participantes";

    return (
      <>
        <EmailDialog
          open={open}
          onOpenChange={setOpen}
          defaultValues={cfg}
          onSubmit={handleSubmit}
        />
        <WsBaseExecutionNode
          {...props}
          icon={MailIcon}
          name="Email p/ participantes"
          description={description}
          status={status}
          onSettings={() => setOpen(true)}
          onDoubleClick={() => setOpen(true)}
        />
      </>
    );
  },
);

WsSendEmailParticipantsNode.displayName = "WsSendEmailParticipantsNode";
