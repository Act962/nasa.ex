"use client";

import { RichtTextEditor } from "../../rich-text-editor/editor";
import { ContainerItemLead } from "../../container-item-lead";

export function TabNotes() {
  return (
    <div className="w-full space-y-4">
      <h2 className="text-lg font-semibold">Adicione um nova nota</h2>
      <RichtTextEditor />
      <div className="flex flex-col gap-5">
        <ContainerItemLead type="Tarefa" />
        <ContainerItemLead type="Reunião" />
      </div>
    </div>
  );
}
