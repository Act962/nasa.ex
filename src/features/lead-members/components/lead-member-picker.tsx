"use client";

import { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeadMembers } from "@/features/lead-members/hooks/use-lead-members";
import { buildMemberTree, type MemberTreeNode } from "@/features/lead-members/lib/member-tree";

// "Para quem?" no preenchimento interno (spec 0076, RF-4): escolhe entre o
// próprio lead e um dos vinculados dele. Lead sem vinculado não mostra nada.

const LEAD_ITSELF = "__lead__";

interface PickerMember {
  id: string;
  parentMemberId: string | null;
  name: string;
  kind: string | null;
}

function flattenInTreeOrder(nodes: MemberTreeNode<PickerMember>[]): MemberTreeNode<PickerMember>[] {
  return nodes.flatMap((node) => [node, ...flattenInTreeOrder(node.children)]);
}

export function LeadMemberPicker({
  leadId,
  leadName,
  value,
  onChange,
  isLocked,
}: {
  leadId: string;
  leadName: string;
  value: string | null;
  onChange: (leadMemberId: string | null) => void;
  /** Depois que a ficha foi criada, o vinculado não muda mais por aqui. */
  isLocked: boolean;
}) {
  const { data } = useLeadMembers(leadId);
  const activeMembers = (data?.members ?? []).filter((member) => !member.archivedAt && !member.promotedLeadId);
  const isValueKnown = value === null || activeMembers.some((member) => member.id === value);

  // Um id que veio na URL e não é deste lead (ou foi arquivado) volta para "o próprio".
  useEffect(() => {
    if (data && !isValueKnown) onChange(null);
  }, [data, isValueKnown, onChange]);

  if (!data || activeMembers.length === 0) return null;

  const orderedMembers = flattenInTreeOrder(buildMemberTree<PickerMember>(activeMembers));

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-b bg-muted/30 px-4 py-2">
      <span className="text-sm font-medium">Para quem é esta ficha?</span>
      <Select value={isValueKnown && value ? value : LEAD_ITSELF} disabled={isLocked} onValueChange={(selected) => onChange(selected === LEAD_ITSELF ? null : selected)}>
        <SelectTrigger className="w-full sm:w-80" aria-label={`Escolher ${data.labels.singular.toLowerCase()}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={LEAD_ITSELF}>{leadName} (o próprio)</SelectItem>
          {orderedMembers.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {`${"— ".repeat(member.depth)}${member.name}${member.kind ? ` · ${member.kind}` : ""}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isLocked && <span className="text-xs text-muted-foreground">Definido ao salvar a ficha.</span>}
    </div>
  );
}
