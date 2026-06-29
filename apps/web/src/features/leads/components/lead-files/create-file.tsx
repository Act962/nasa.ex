"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Uploader } from "@/components/file-uploader/uploader";
import { useEffect, useState } from "react";

interface CreateFileProps {
  children: React.ReactNode;
  onConfirm: (name: string, fileUrl: string) => void;
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateFile({
  children,
  onConfirm,
  disabled,
  open,
  onOpenChange,
}: CreateFileProps) {
  const [name, setName] = useState<string>("");
  const [file, setFile] = useState<string | null>(null);

  function onSubmit() {
    if (!name || !file) return;
    onConfirm(name, file);
  }

  const onUpload = (key: string, fileName?: string) => {
    setFile(key);
    console.log(name);
    if (fileName && !name) {
      setName(fileName);
    }
  };

  const isDisabled = !name || !file || disabled;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Novo arquivo</DialogTitle>
          <DialogDescription>
            Adicione um novo arquivo ao lead.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <Label htmlFor="name-1">
              Nome <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name-1"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field>
            <Uploader fileTypeAccepted="outros" onUpload={onUpload} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="button" disabled={isDisabled} onClick={onSubmit}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
