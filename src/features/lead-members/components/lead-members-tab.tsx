"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, ExternalLink, Merge, Pencil, Plus, Settings2, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useLeadMembers,
  usePromoteLeadMember,
  useUpdateLeadMember,
  useUpdateLeadMemberLabels,
} from "@/features/lead-members/hooks/use-lead-members";
import { buildMemberTree, wouldCreateCycle } from "@/features/lead-members/lib/member-tree";
import { EMPTY_MEMBER_FORM, LeadMemberFormDialog, type LeadMemberFormValues } from "./lead-member-form-dialog";
import { LeadMemberOrgChart, type OrgChartMember } from "./lead-member-org-chart";
import { MergeLeadDialog } from "./merge-lead-dialog";

// Aba de vinculados do lead (spec 0076, fase 1): organograma, cadastro,
// edição, arquivamento e o nome que a empresa dá aos vinculados.

function LabelsEditor({ singular, plural }: { singular: string; plural: string }) {
  const [singularText, setSingularText] = useState(singular);
  const [pluralText, setPluralText] = useState(plural);
  const updateLabels = useUpdateLeadMemberLabels();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Mudar o nome dos vinculados">
          <Settings2 className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-sm font-medium">Como sua empresa chama os vinculados?</p>
        <div className="space-y-1">
          <Label htmlFor="member-label-singular">Um</Label>
          <Input id="member-label-singular" value={singularText} maxLength={30} placeholder="Ex.: Paciente, Loja" onChange={(event) => setSingularText(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="member-label-plural">Vários</Label>
          <Input id="member-label-plural" value={pluralText} maxLength={30} placeholder="Ex.: Pacientes, Lojas" onChange={(event) => setPluralText(event.target.value)} />
        </div>
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={updateLabels.isPending}
          onClick={() =>
            updateLabels.mutate(
              { singular: singularText, plural: pluralText },
              { onSuccess: () => toast.success("Nome atualizado."), onError: (error) => toast.error(error.message || "Não foi possível salvar.") },
            )
          }
        >
          Salvar nome
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function LeadMembersTab({ leadId }: { leadId: string }) {
  const { data, isLoading, isError } = useLeadMembers(leadId);
  const updateMember = useUpdateLeadMember();
  const [formValues, setFormValues] = useState<LeadMemberFormValues | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const promoteMember = usePromoteLeadMember();
  const [memberToPromote, setMemberToPromote] = useState<{ id: string; name: string } | null>(null);
  const [isMergeOpen, setIsMergeOpen] = useState(false);

  const chartMembers = useMemo<(OrgChartMember & { source: NonNullable<typeof data>["members"][number] })[]>(
    () =>
      (data?.members ?? [])
        .filter((member) => showArchived || !member.archivedAt)
        .map((member) => ({
          id: member.id,
          parentMemberId: member.parentMemberId,
          name: member.name,
          kind: member.kind,
          recordCount: member.recordCount,
          isArchived: Boolean(member.archivedAt),
          isPromoted: Boolean(member.promotedLeadId),
          source: member,
        })),
    [data?.members, showArchived],
  );

  if (isLoading) return <p className="p-4 text-sm text-muted-foreground">Carregando...</p>;
  if (isError || !data) return <p className="p-4 text-sm text-muted-foreground">Não foi possível carregar os vinculados deste lead.</p>;

  const { labels, lead, members, canEdit, costCenters } = data;
  const activeMembers = members.filter((member) => !member.archivedAt && !member.promotedLeadId);
  const archivedCount = members.filter((member) => member.archivedAt).length;

  const openEdit = (member: (typeof members)[number]) =>
    setFormValues({
      id: member.id,
      name: member.name,
      kind: member.kind ?? "",
      parentMemberId: member.parentMemberId,
      billingMode: member.billingMode,
      costCenterId: member.costCenterId,
      newCostCenterName: "",
      document: member.document ?? "",
      birthDate: member.birthDate ?? "",
      phone: member.phone ?? "",
      email: member.email ?? "",
      notes: member.notes ?? "",
    });

  const toggleArchived = (member: (typeof members)[number]) =>
    updateMember.mutate(
      { id: member.id, archived: !member.archivedAt },
      {
        onSuccess: () => toast.success(member.archivedAt ? "Reativado." : "Arquivado."),
        onError: (error) => toast.error(error.message || "Não foi possível alterar."),
      },
    );

  const parentOptions = activeMembers
    .filter((candidate) => !formValues?.id || (candidate.id !== formValues.id && !wouldCreateCycle(members, formValues.id, candidate.id)))
    .map((candidate) => ({ id: candidate.id, name: candidate.name }));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{labels.plural}</h2>
          <p className="text-sm text-muted-foreground">Quem está ligado a {lead.name}: filhos, filiais, unidades. Não entram no funil.</p>
        </div>
        <div className="flex items-center gap-1">
          <LabelsEditor singular={labels.singular} plural={labels.plural} />
          {canEdit && (
            <Button type="button" size="sm" variant="outline" onClick={() => setIsMergeOpen(true)}>
              <Merge className="size-4" />
              Juntar lead
            </Button>
          )}
          {canEdit && (
            <Button type="button" size="sm" data-guide={GUIDE_ANCHORS.leadMembersNewButton.id} onClick={() => setFormValues(EMPTY_MEMBER_FORM)}>
              <Plus className="size-4" />
              Novo {labels.singular.toLowerCase()}
            </Button>
          )}
        </div>
      </div>

      <LeadMemberOrgChart
        rootName={lead.name}
        rootSubtitle={`Titular · ${activeMembers.length} ${activeMembers.length === 1 ? labels.singular.toLowerCase() : labels.plural.toLowerCase()}`}
        nodes={buildMemberTree(chartMembers)}
        renderActions={(chartMember) =>
          chartMember.isPromoted && chartMember.source.promotedLeadId ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/contatos/${chartMember.source.promotedLeadId}`}>
                <ExternalLink className="size-4" />
                Abrir lead
              </Link>
            </Button>
          ) : canEdit ? (
            <div className="flex shrink-0 items-center">
              {!chartMember.isArchived && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Transformar ${chartMember.name} em lead`}
                  title="Transformar em lead"
                  onClick={() => setMemberToPromote({ id: chartMember.id, name: chartMember.name })}
                >
                  <UserRoundPlus className="size-4" />
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar ${chartMember.name}`} onClick={() => openEdit(chartMember.source)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${chartMember.isArchived ? "Reativar" : "Arquivar"} ${chartMember.name}`}
                disabled={updateMember.isPending}
                onClick={() => toggleArchived(chartMember.source)}
              >
                {chartMember.isArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
              </Button>
            </div>
          ) : null
        }
      />

      {members.length === 0 && (
        <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
          Nenhum {labels.singular.toLowerCase()} ainda.{canEdit ? " Adicione o primeiro pelo botão acima." : ""}
        </p>
      )}
      {!canEdit && <p className="text-xs text-muted-foreground">Só quem participa do tracking deste lead pode alterar.</p>}
      {archivedCount > 0 && (
        <Button type="button" variant="link" size="sm" className="px-0" onClick={() => setShowArchived((current) => !current)}>
          {showArchived ? "Ocultar arquivados" : `Mostrar arquivados (${archivedCount})`}
        </Button>
      )}

      <ConfirmDialog
        isOpen={Boolean(memberToPromote)}
        title={`Transformar ${memberToPromote?.name ?? ""} em lead?`}
        description={`Ele passa a ser um lead próprio, no mesmo tracking e na mesma etapa de ${lead.name}, e leva as fichas abertas. Precisa ter telefone cadastrado. Conta como criação de lead (cobra Stars) e não dá para desfazer por aqui.`}
        confirmText="Transformar em lead"
        isLoading={promoteMember.isPending}
        onCancel={() => setMemberToPromote(null)}
        onConfirm={() => {
          if (!memberToPromote) return;
          promoteMember.mutate(
            { id: memberToPromote.id },
            {
              onSuccess: () => {
                toast.success(`${memberToPromote.name} agora é um lead.`);
                setMemberToPromote(null);
              },
              onError: (error) => {
                toast.error(error.message || "Não foi possível transformar em lead.");
                setMemberToPromote(null);
              },
            },
          );
        }}
      />
      {isMergeOpen && <MergeLeadDialog titularLeadId={lead.id} titularName={lead.name} singularLabel={labels.singular} onClose={() => setIsMergeOpen(false)} />}

      {formValues && (
        <LeadMemberFormDialog
          leadId={lead.id}
          leadName={lead.name}
          singularLabel={labels.singular}
          initialValues={formValues}
          parentOptions={parentOptions}
          costCenterOptions={costCenters}
          onClose={() => setFormValues(null)}
        />
      )}
    </div>
  );
}
