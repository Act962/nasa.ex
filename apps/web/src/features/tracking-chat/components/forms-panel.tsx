"use client";

import {
  FileTextIcon,
  XIcon,
  PlusIcon,
  SendIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useQueryListForms } from "@/features/form/hooks/use-form";
import { useRouter } from "next/navigation";

interface FormsPanelProps {
  onClose: () => void;
  onSendLink: (text: string) => void;
}

export function FormsPanel({ onClose, onSendLink }: FormsPanelProps) {
  const router = useRouter();
  const { forms, isLoading } = useQueryListForms();

  const handleSend = (formId: string, formName: string) => {
    const link = `${window.location.origin}/submit-form/${formId}`;
    onSendLink(`📋 ${formName}\n${link}`);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Painel */}
      <div
        className="
          fixed z-50
          w-[90vw] max-w-md
          bg-background border border-border shadow-2xl flex flex-col overflow-hidden
          bottom-0 left-1/2 -translate-x-1/2 rounded-t-2xl
          lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:rounded-2xl
        "
        style={{ maxHeight: "80vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <FileTextIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Formulário</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                onClose();
                router.push("/form");
              }}
            >
              <PlusIcon className="size-3.5" />
              Novo formulário
            </Button>
            <button
              onClick={onClose}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="size-5" />
            </div>
          ) : forms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
              <FileTextIcon className="size-10 text-muted-foreground/30" />
              <p className="text-sm font-medium">Nenhum formulário criado</p>
              <p className="text-xs text-muted-foreground">
                Crie um formulário para enviar ao lead.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  router.push("/form");
                }}
              >
                <PlusIcon className="size-3.5 mr-1.5" />
                Criar formulário
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {forms.map((form) => (
                <li
                  key={form.id}
                  className="flex items-center justify-between px-5 py-3 gap-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileTextIcon className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{form.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2 gap-1"
                      onClick={() =>
                        window.open(`/submit-form/${form.id}`, "_blank")
                      }
                    >
                      <ExternalLinkIcon className="size-3" />
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs px-2.5 gap-1.5"
                      onClick={() => handleSend(form.id, form.name)}
                    >
                      <SendIcon className="size-3" />
                      Enviar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
