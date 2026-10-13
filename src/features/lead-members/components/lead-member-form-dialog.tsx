import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { emitTourResult } from "@/features/tour/store";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateLeadMember, useUpdateLeadMember } from "@/features/lead-members/hooks/use-lead-members";

// Cadastro e edição de um vinculado do lead (spec 0076, RF-1 e RF-3).

const NO_PARENT = "__lead__";
const NO_COST_CENTER = "__none__";
const NEW_COST_CENTER = "__new__";

export interface LeadMemberFormValues {
  id?: string;
  name: string;
  kind: string;
  parentMemberId: string | null;
  billingMode: "TITULAR" | "PROPRIO";
  costCenterId: string | null;
  newCostCenterName: string;
  document: string;
  birthDate: string;
  phone: string;
  email: string;
  notes: string;
}

export const EMPTY_MEMBER_FORM: LeadMemberFormValues = {
  name: "",
  kind: "",
  parentMemberId: null,
  billingMode: "TITULAR",
  costCenterId: null,
  newCostCenterName: "",
  document: "",
  birthDate: "",
  phone: "",
  email: "",
  notes: "",
};

export function LeadMemberFormDialog({
  leadId,
  leadName,
  singularLabel,
  initialValues,
  parentOptions,
  costCenterOptions,
  onClose,
}: {
  leadId: string;
  leadName: string;
  singularLabel: string;
  initialValues: LeadMemberFormValues;
  /** Vinculados que podem ficar acima deste (o servidor confere de novo). */
  parentOptions: { id: string; name: string }[];
  /** Centros de custo do Financeiro. */
  costCenterOptions: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [values, setValues] = useState<LeadMemberFormValues>(initialValues);
  const [isCreatingCostCenter, setIsCreatingCostCenter] = useState(false);
  const createMember = useCreateLeadMember();
  const updateMember = useUpdateLeadMember();
  const isEditing = Boolean(initialValues.id);
  const isSaving = createMember.isPending || updateMember.isPending;

  const setField = <Field extends keyof LeadMemberFormValues>(field: Field, value: LeadMemberFormValues[Field]) =>
    setValues((current) => ({ ...current, [field]: value }));

  const save = () => {
    const payload = {
      name: values.name.trim(),
      kind: values.kind.trim() || null,
      parentMemberId: values.parentMemberId,
      billingMode: values.billingMode,
      costCenterId: isCreatingCostCenter ? null : values.costCenterId,
      newCostCenterName: isCreatingCostCenter ? values.newCostCenterName.trim() || null : null,
      document: values.document.trim() || null,
      birthDate: values.birthDate || null,
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
      notes: values.notes.trim() || null,
    };
    const callbacks = {
      onSuccess: () => {
        toast.success(isEditing ? "Alterações salvas." : `${singularLabel} adicionado.`);
        emitTourResult({ kind: GUIDE_RESULT_KINDS.leadMemberSaved });
        onClose();
      },
      onError: (error: Error) => toast.error(error.message || "Não foi possível salvar."),
    };
    if (initialValues.id) updateMember.mutate({ id: initialValues.id, ...payload }, callbacks);
    else createMember.mutate({ leadId, ...payload }, callbacks);
  };

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Editar ${singularLabel.toLowerCase()}` : `Novo ${singularLabel.toLowerCase()}`}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="member-name">Nome</Label>
            <Input id="member-name" data-guide={GUIDE_ANCHORS.leadMemberName.id} value={values.name} maxLength={120} autoFocus onChange={(event) => setField("name", event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="member-kind">Tipo</Label>
            <Input id="member-kind" value={values.kind} maxLength={60} placeholder="Ex.: Filho, Filial" onChange={(event) => setField("kind", event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Fica abaixo de</Label>
            <Select value={values.parentMemberId ?? NO_PARENT} onValueChange={(parentId) => setField("parentMemberId", parentId === NO_PARENT ? null : parentId)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PARENT}>{leadName} (direto no lead)</SelectItem>
                {parentOptions.map((parentOption) => (
                  <SelectItem key={parentOption.id} value={parentOption.id}>
                    {parentOption.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Cobrança</Label>
            <Select value={values.billingMode} onValueChange={(billingMode) => setField("billingMode", billingMode as LeadMemberFormValues["billingMode"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TITULAR">Na conta de {leadName}</SelectItem>
                <SelectItem value="PROPRIO">Conta própria, em nome deste {singularLabel.toLowerCase()}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {values.billingMode === "PROPRIO" && (
            <div className="space-y-1 sm:col-span-2">
              <Label>Centro de custo no Financeiro</Label>
              <Select
                value={isCreatingCostCenter ? NEW_COST_CENTER : (values.costCenterId ?? NO_COST_CENTER)}
                onValueChange={(selected) => {
                  setIsCreatingCostCenter(selected === NEW_COST_CENTER);
                  setField("costCenterId", selected === NO_COST_CENTER || selected === NEW_COST_CENTER ? null : selected);
                  if (selected === NEW_COST_CENTER && !values.newCostCenterName) setField("newCostCenterName", values.name.trim());
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COST_CENTER}>Sem centro de custo</SelectItem>
                  {costCenterOptions.map((costCenterOption) => (
                    <SelectItem key={costCenterOption.id} value={costCenterOption.id}>
                      {costCenterOption.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_COST_CENTER}>Criar um novo...</SelectItem>
                </SelectContent>
              </Select>
              {isCreatingCostCenter && (
                <Input
                  value={values.newCostCenterName}
                  maxLength={80}
                  placeholder="Nome do novo centro de custo"
                  aria-label="Nome do novo centro de custo"
                  onChange={(event) => setField("newCostCenterName", event.target.value)}
                />
              )}
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="member-document">Documento</Label>
            <Input id="member-document" value={values.document} maxLength={40} placeholder="CPF ou CNPJ" onChange={(event) => setField("document", event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="member-birth">Data de nascimento</Label>
            <Input id="member-birth" type="date" value={values.birthDate} onChange={(event) => setField("birthDate", event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="member-phone">Telefone</Label>
            <Input id="member-phone" value={values.phone} maxLength={30} inputMode="tel" onChange={(event) => setField("phone", event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="member-email">E-mail</Label>
            <Input id="member-email" type="email" value={values.email} maxLength={160} onChange={(event) => setField("email", event.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="member-notes">Observação</Label>
            <Textarea id="member-notes" rows={3} value={values.notes} maxLength={2000} onChange={(event) => setField("notes", event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" data-guide={GUIDE_ANCHORS.leadMemberSave.id} disabled={isSaving || values.name.trim().length === 0} onClick={save}>
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
