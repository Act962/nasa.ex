import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutationLeadUpdate } from "../../hooks/use-lead-update";
import { useState, useRef, useEffect } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { Textarea } from "@/components/ui/textarea";

interface ObservationLeadProps {
  leadId: string;
  trackingId: string;
  description: string | null;
}
export function ObservationLead({
  leadId,
  trackingId,
  description,
}: ObservationLeadProps) {
  const [editor, setEditor] = useState(description || "");
  const debouncedEditor = useDebouncedValue(editor, 600);

  const lastSavedRef = useRef(description || "");
  const mutation = useMutationLeadUpdate(leadId, trackingId);

  // 🔥 sincroniza quando vier do backend
  useEffect(() => {
    const value = description || "";

    setEditor(value);
    lastSavedRef.current = value;
  }, [description]);

  useEffect(() => {
    if (!leadId) return;

    if (debouncedEditor === lastSavedRef.current) return;

    mutation.mutate(
      {
        id: leadId,
        description: debouncedEditor,
      },
      {
        onSuccess() {
          lastSavedRef.current = debouncedEditor;
        },
      },
    );
  }, [debouncedEditor, leadId]);

  return (
    <div className="flex flex-col w-full h-full min-h-0 space-y-4">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold">Observações</h2>
      </div>

      <ScrollArea className="flex-1 w-full min-h-0 rounded-md">
        <Textarea
          placeholder="Adicione suas observações aqui..."
          className=" w-full h-full min-h-50"
          value={editor}
          onChange={(e) => setEditor(e.target.value)}
        />
      </ScrollArea>
    </div>
  );
}
