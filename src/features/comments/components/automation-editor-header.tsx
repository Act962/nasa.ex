"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, Loader2, SaveIcon, Trash2Icon } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  useDeleteCommentsAutomation,
  useRenameCommentsAutomation,
} from "../hooks/use-comments-automations";

/**
 * Header do editor, no mesmo desenho do editor de workflows do tracking:
 * largura total acima das duas colunas, breadcrumb com título editável no
 * lugar, e as ações de estado (ativar, excluir, salvar) à direita.
 */
export function AutomationEditorHeader({
  automationId,
  name,
  isActive,
  onSave,
  isSaving,
  onToggleActive,
  isTogglingActive,
}: {
  automationId: string;
  name: string;
  isActive: boolean;
  onSave: () => void;
  isSaving: boolean;
  onToggleActive: (isActive: boolean) => void;
  isTogglingActive: boolean;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b bg-background px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Button asChild size="sm" variant="ghost" className="gap-1.5">
          <Link href="/comments">
            <ArrowLeftIcon className="size-4" />
            Voltar
          </Link>
        </Button>
        <span className="text-muted-foreground/50">|</span>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/comments">Automações</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <AutomationNameInput automationId={automationId} name={name} />
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{isActive ? "Ativa" : "Pausada"}</span>
          <Switch
            checked={isActive}
            disabled={isTogglingActive}
            onCheckedChange={onToggleActive}
            aria-label={isActive ? "Desativar automação" : "Ativar automação"}
          />
        </label>

        <DeleteAutomationButton automationId={automationId} />

        <Button size="sm" onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SaveIcon className="size-4" />
          )}
          Salvar
        </Button>
      </div>
    </div>
  );
}

function AutomationNameInput({
  automationId,
  name,
}: {
  automationId: string;
  name: string;
}) {
  const rename = useRenameCommentsAutomation();
  const [isEditing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(name), [name]);
  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const save = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === name) {
      setDraft(name);
      setEditing(false);
      return;
    }

    rename.mutate(
      { id: automationId, name: trimmed },
      {
        onError: (error) => {
          setDraft(name);
          toast.error(error.message);
        },
        onSettled: () => setEditing(false),
      },
    );
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        disabled={rename.isPending}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") save();
          else if (event.key === "Escape") {
            setDraft(name);
            setEditing(false);
          }
        }}
        className="h-7 w-auto min-w-40 px-2"
      />
    );
  }

  return (
    <BreadcrumbItem
      onClick={() => setEditing(true)}
      className="cursor-pointer truncate transition-colors hover:text-foreground"
      title="Clique para renomear"
    >
      {name}
    </BreadcrumbItem>
  );
}

function DeleteAutomationButton({ automationId }: { automationId: string }) {
  const router = useRouter();
  const remove = useDeleteCommentsAutomation();
  const [isOpen, setOpen] = useState(false);

  return (
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label="Excluir automação"
      >
        <Trash2Icon className="size-4 text-red-500" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir automação</DialogTitle>
            <DialogDescription>
              O gatilho, as respostas e o histórico de execuções desta automação
              serão apagados. Não dá para desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(
                  { id: automationId },
                  {
                    onSuccess: () => {
                      setOpen(false);
                      toast.success("Automação excluída");
                      router.push("/comments");
                    },
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            >
              {remove.isPending && <Loader2 className="size-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
