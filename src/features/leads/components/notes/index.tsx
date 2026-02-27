"use client";

import { Button } from "@/components/ui/button";
import { RichtTextEditor } from "../../../../components/rich-text-editor/editor";
import { ContainerItemLead } from "./container-item-lead";
import {
  useMutationCreateLeadAction,
  useQueryLeadAction,
} from "@/features/leads/hooks/use-lead-action";
import { useState } from "react";

interface TabNotesProps {
  leadId: string;
  trackingId: string;
}

export function TabNotes({ leadId, trackingId }: TabNotesProps) {
  const { data, isLoading } = useQueryLeadAction({ leadId });
  const mutation = useMutationCreateLeadAction({ leadId });
  const [editor, setEditor] = useState<string | undefined>(undefined);

  const onSubmit = () => {
    mutation.mutate({
      leadId,
      description: editor,
      title: "Tarefa vazia",
      trackingId,
    });
    setEditor("");
  };

  if (isLoading) return <div>Loading...</div>;
  return (
    <div className="w-full space-y-4">
      <RichtTextEditor
        disabled={mutation.isPending}
        field={editor}
        onChange={setEditor}
      >
        <Button className="ml-auto" onClick={onSubmit}>
          Adicionar nota
        </Button>
      </RichtTextEditor>
      <div className="flex flex-col gap-5">
        {data?.actions.map((action) => (
          <ContainerItemLead
            key={action.id}
            {...action}
            trackingId={trackingId}
          />
        ))}
      </div>
    </div>
  );
}
