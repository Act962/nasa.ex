"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRef, type ReactNode } from "react";

/**
 * Dialog base compartilhado pelas 7 actions "Adicionar Lead no App".
 *
 * Cada action wrapper (send-form/dialog.tsx, etc) passa:
 *  - title, description
 *  - children — campos customizados de configuração (selector do recurso,
 *    + extras pra Proposta/Contrato etc)
 *  - messageTemplate + onMessageTemplateChange — campo de mensagem
 *    opcional (texto livre com variáveis {{nome}} etc)
 *  - defaultMessagePreview — placeholder/exemplo do template default
 *  - onSubmit / onCancel
 *  - canSubmit — controla disable do botão Salvar
 *
 * Sem variável picker (autocomplete) — texto livre + lista de variáveis
 * disponíveis abaixo da textarea. Pra MVP, sem complexidade.
 */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Campos custom (selector + extras) renderizados antes da mensagem. */
  children: ReactNode;
  /** Texto da template (opcional — placeholder mostra default). */
  messageTemplate: string;
  onMessageTemplateChange: (v: string) => void;
  /** Default mostrado como placeholder + dica abaixo do textarea. */
  defaultMessagePreview: string;
  /** Variáveis app-specific extras (além das globais). */
  extraVariables?: string[];
  onSubmit: () => void;
  canSubmit: boolean;
}

const GLOBAL_VARIABLES = [
  "{{nome}}",
  "{{email}}",
  "{{phone}}",
  "{{data}}",
  "{{responsavel}}",
  "{{track}}",
  "{{status}}",
];

export function SendAppActionBaseDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  messageTemplate,
  onMessageTemplateChange,
  defaultMessagePreview,
  extraVariables = [],
  onSubmit,
  canSubmit,
}: Props) {
  const allVars = ["{{url}}", ...extraVariables, ...GLOBAL_VARIABLES];
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Insere a variável na posição atual do cursor (ou no fim, se o
   * textarea não estiver focado). Mantém o foco depois pra UX continuar
   * fluida — usuário clica, vê inserido, continua digitando.
   */
  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    const current = messageTemplate;

    if (!textarea) {
      onMessageTemplateChange(current + variable);
      return;
    }

    const start = textarea.selectionStart ?? current.length;
    const end = textarea.selectionEnd ?? current.length;
    const next = current.slice(0, start) + variable + current.slice(end);
    onMessageTemplateChange(next);

    // Reposiciona cursor depois da variável inserida no próximo tick
    requestAnimationFrame(() => {
      const pos = start + variable.length;
      textarea.focus();
      textarea.setSelectionRange(pos, pos);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {children}

          <div className="space-y-2">
            <Label htmlFor="messageTemplate">
              Mensagem (opcional — usa default se em branco)
            </Label>
            <Textarea
              id="messageTemplate"
              ref={textareaRef}
              value={messageTemplate}
              onChange={(e) => onMessageTemplateChange(e.target.value)}
              placeholder={defaultMessagePreview}
              rows={4}
              className="font-mono text-xs"
            />
            <div className="space-y-1">
              <div className="text-[10px] text-muted-foreground">
                Clique pra inserir:
              </div>
              <div className="flex flex-wrap gap-1">
                {allVars.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/40 hover:bg-muted hover:border-foreground/30 transition-colors cursor-pointer"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={onSubmit} disabled={!canSubmit}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
