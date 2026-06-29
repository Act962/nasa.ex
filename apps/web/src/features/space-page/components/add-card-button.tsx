"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { Plus, FileText, FolderArchive, Calendar, Link2 } from "lucide-react";

interface AddCardButtonProps {
  /**
   * Chamado quando o usuário escolhe um tipo. Útil pro pai injetar o card
   * no layout local. Se omitido, navegamos pro app correspondente.
   */
  onAdd?: (
    type: "form" | "nbox" | "calendar" | "linnker",
  ) => void;
}

/**
 * "Adicionar bloco" — card especial renderizado entre os cards da
 * Spacehome (admin only). Visual: contorno seccionado com texto
 * "Adicionar" no meio. Ao clicar abre dialog com 4 opções:
 * Formulário · Arquivo no N-Box · Agendar · Linnker.
 *
 * Cada opção navega pro app NASA correspondente (onde o usuário cria
 * o item) — quando voltar pra Spacehome, o item já aparece se foi
 * marcado como público.
 */
export function AddCardButton({ onAdd }: AddCardButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function pick(type: "form" | "nbox" | "calendar" | "linnker") {
    setOpen(false);
    if (onAdd) {
      onAdd(type);
      return;
    }
    const target = {
      form:     "/form",
      nbox:     "/nbox",
      calendar: "/agendas",
      linnker:  "/linnker",
    }[type];
    router.push(target);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 bg-transparent p-8 text-sm text-white/50 transition hover:border-orange-400/40 hover:bg-orange-500/5 hover:text-orange-200"
      >
        <Plus className="size-5" />
        <span className="font-medium">Adicionar</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar à Spacehome</DialogTitle>
            <DialogDescription>
              Escolha o tipo de bloco. Você será levado ao app NASA correspondente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <Option
              icon={<FileText className="size-5 text-orange-400" />}
              label="Formulário"
              hint="Trabalhe conosco / contato"
              onClick={() => pick("form")}
            />
            <Option
              icon={<FolderArchive className="size-5 text-orange-400" />}
              label="Arquivo no N-Box"
              hint="Catálogo / brochura / PDF"
              onClick={() => pick("nbox")}
            />
            <Option
              icon={<Calendar className="size-5 text-orange-400" />}
              label="Agendar"
              hint="Eventos públicos / reuniões"
              onClick={() => pick("calendar")}
            />
            <Option
              icon={<Link2 className="size-5 text-orange-400" />}
              label="Integrar Linnker"
              hint="Página de links com mockup mobile"
              onClick={() => pick("linnker")}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Option({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-1.5 rounded-xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-orange-400/40 hover:bg-orange-500/10"
    >
      {icon}
      <span className="text-sm font-medium text-white">{label}</span>
      <span className="text-xs text-white/60">{hint}</span>
    </button>
  );
}
