"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputGroupTextarea } from "@/components/ui/input-group";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialBody: string;
  onSave: (body: string) => void;
}

export function EditMessageDialog({
  isOpen,
  onOpenChange,
  initialBody,
  onSave,
}: Props) {
  const [body, setBody] = useState(initialBody);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setBody(initialBody);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, initialBody]);

  const handleSave = () => {
    const trimmed = body.trim();
    if (trimmed) onSave(trimmed);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar mensagem</DialogTitle>
        </DialogHeader>

        <InputGroupTextarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="resize-none min-h-24 py-2 text-sm"
          placeholder="Edite a mensagem"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSave();
            }
          }}
        />

        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave}>
            <Check className="size-3.5 mr-1" />
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
