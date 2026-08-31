"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardListIcon, ArrowUpRightIcon } from "lucide-react";
import { SidebarField } from "./sidebar-field";
import { ActionFormsDialog } from "@/features/actions/components/action-forms-dialog";
import { Action } from "../../../types";

interface GeneratedFromFormFieldProps {
  actionId: string;
  formResponse: NonNullable<Action["formResponse"]>;
}

// Mostra o formulário que gerou esta action (via Action.formResponseId), com
// atalho para a resposta. Só é renderizado quando a action nasceu de um form.
export function GeneratedFromFormField({
  actionId,
  formResponse,
}: GeneratedFromFormFieldProps) {
  const [isFormsDialogOpen, setFormsDialogOpen] = useState(false);
  const form = formResponse.form;
  if (!form) return null;

  return (
    <SidebarField
      label="Gerado pelo formulário"
      icon={<ClipboardListIcon className="size-3" />}
    >
      <div className="flex flex-col gap-1.5">
        <Link
          href={`/formulario/${form.id}/${formResponse.id}`}
          className="group flex items-center gap-2 rounded-md border border-input bg-transparent px-2 py-1.5 transition-colors hover:bg-accent dark:bg-input/30 dark:hover:bg-input/50"
        >
          <span className="truncate text-xs font-medium">{form.name}</span>
          <ArrowUpRightIcon className="ml-auto size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
        </Link>

        <button
          type="button"
          onClick={() => setFormsDialogOpen(true)}
          className="text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Ver formulários desta tarefa
        </button>
      </div>

      {isFormsDialogOpen && (
        <ActionFormsDialog
          actionId={actionId}
          open={isFormsDialogOpen}
          onOpenChange={setFormsDialogOpen}
        />
      )}
    </SidebarField>
  );
}
