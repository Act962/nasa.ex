"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCreateCompanyCredential,
  useUpdateCompanyCredential,
} from "@/features/accounting/hooks/use-accounting-credentials";
import { CREDENTIAL_PORTALS, findCredentialPortal } from "./credential-portals";

export interface EditableCredential {
  id: string;
  portal: string;
  label: string;
  username: string | null;
  url: string | null;
  notes: string | null;
}

interface CredentialFormDialogProps {
  isOpen: boolean;
  credential: EditableCredential | null;
  onClose: () => void;
}

interface CredentialFormValues {
  portal: string;
  label: string;
  username: string;
  secret: string;
  url: string;
  notes: string;
}

const EMPTY_VALUES: CredentialFormValues = { portal: "", label: "", username: "", secret: "", url: "", notes: "" };

export function CredentialFormDialog({ isOpen, credential, onClose }: CredentialFormDialogProps) {
  const [values, setValues] = useState<CredentialFormValues>(EMPTY_VALUES);
  const [isSecretVisible, setIsSecretVisible] = useState(false);
  const createCredential = useCreateCompanyCredential();
  const updateCredential = useUpdateCompanyCredential();
  const isEditing = !!credential;
  const isSaving = createCredential.isPending || updateCredential.isPending;

  useEffect(() => {
    if (!isOpen) return;
    setIsSecretVisible(false);
    setValues(
      credential
        ? {
            portal: credential.portal,
            label: credential.label,
            username: credential.username ?? "",
            secret: "",
            url: credential.url ?? "",
            notes: credential.notes ?? "",
          }
        : EMPTY_VALUES,
    );
  }, [isOpen, credential]);

  function selectPortal(portalId: string) {
    const portal = findCredentialPortal(portalId);
    setValues((currentValues) => ({
      ...currentValues,
      portal: portalId,
      label: currentValues.label || (portal && portal.id !== "OUTRO" ? portal.label : ""),
      url: portal?.url ?? currentValues.url,
    }));
  }

  function updateField(fieldName: keyof CredentialFormValues, fieldValue: string) {
    setValues((currentValues) => ({ ...currentValues, [fieldName]: fieldValue }));
  }

  const canSave = !!values.portal && !!values.label.trim() && (isEditing || !!values.secret) && !isSaving;

  function save() {
    const payload = {
      portal: values.portal,
      label: values.label.trim(),
      username: values.username.trim() || null,
      url: values.url.trim() || null,
      notes: values.notes.trim() || null,
    };
    const callbacks = {
      onSuccess: () => {
        toast.success(isEditing ? "Credencial atualizada." : "Credencial guardada no cofre.");
        onClose();
      },
      onError: (error: Error) => toast.error(error.message || "Não foi possível salvar."),
    };
    if (credential) {
      updateCredential.mutate({ ...payload, credentialId: credential.id, secret: values.secret || undefined }, callbacks);
    } else {
      createCredential.mutate({ ...payload, secret: values.secret }, callbacks);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(isDialogOpen) => !isDialogOpen && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar credencial" : "Nova credencial"}</DialogTitle>
          <DialogDescription>A senha é cifrada antes de ser gravada. Ninguém a vê sem confirmar a biometria.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="credential-portal">Portal</Label>
            <Select value={values.portal} onValueChange={selectPortal}>
              <SelectTrigger id="credential-portal" className="w-full">
                <SelectValue placeholder="Onde se usa esta senha?" />
              </SelectTrigger>
              <SelectContent>
                {CREDENTIAL_PORTALS.map((portal) => (
                  <SelectItem key={portal.id} value={portal.id}>
                    {portal.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="credential-label">Nome para identificar</Label>
            <Input id="credential-label" value={values.label} maxLength={120} onChange={(event) => updateField("label", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="credential-username">Usuário, CPF ou CNPJ de acesso</Label>
            <Input
              id="credential-username"
              value={values.username}
              maxLength={160}
              autoComplete="off"
              onChange={(event) => updateField("username", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="credential-secret">{isEditing ? "Nova senha (deixe vazio para manter)" : "Senha"}</Label>
            <div className="relative">
              <Input
                id="credential-secret"
                type={isSecretVisible ? "text" : "password"}
                value={values.secret}
                maxLength={500}
                autoComplete="new-password"
                className="pr-10"
                onChange={(event) => updateField("secret", event.target.value)}
              />
              <button
                type="button"
                aria-label={isSecretVisible ? "Esconder senha" : "Mostrar senha"}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setIsSecretVisible((isVisible) => !isVisible)}
              >
                {isSecretVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="credential-url">Link de acesso</Label>
            <Input
              id="credential-url"
              value={values.url}
              maxLength={300}
              placeholder="https://"
              onChange={(event) => updateField("url", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="credential-notes">Observações</Label>
            <Textarea
              id="credential-notes"
              value={values.notes}
              maxLength={1000}
              rows={2}
              placeholder="Ex.: código de acesso do Simples, perguntas de segurança…"
              onChange={(event) => updateField("notes", event.target.value)}
            />
          </div>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button className="bg-info text-white hover:bg-info" disabled={!canSave} onClick={save}>
              {isSaving && <OrbitaSpinner className="size-3.5 " />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
