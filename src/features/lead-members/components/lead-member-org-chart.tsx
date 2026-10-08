"use client";

import { useState, type ReactNode } from "react";
import { Building2, ChevronDown, ChevronRight, UserRound } from "lucide-react";
import type { MemberTreeItem, MemberTreeNode } from "@/features/lead-members/lib/member-tree";

// Organograma dos vinculados (spec 0076, RF-12): o titular em cima e cada
// vinculado ligado ao nível de cima por uma linha. Quem tem alguém abaixo
// pode ser recolhido.

export interface OrgChartMember extends MemberTreeItem {
  name: string;
  kind: string | null;
  recordCount: number;
  isArchived: boolean;
  isPromoted: boolean;
}

function countDescendants<Member extends OrgChartMember>(nodes: MemberTreeNode<Member>[]): number {
  return nodes.reduce((total, node) => total + 1 + countDescendants(node.children), 0);
}

function NodeCard({
  title,
  subtitle,
  isRoot,
  isMuted,
  actions,
  collapse,
}: {
  title: string;
  subtitle: string;
  isRoot?: boolean;
  isMuted?: boolean;
  actions?: ReactNode;
  /** Ausente quando não há ninguém abaixo. */
  collapse?: { isCollapsed: boolean; hiddenCount: number; onToggle: () => void };
}) {
  const Icon = isRoot ? Building2 : UserRound;
  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 ${isRoot ? "border-primary/40 bg-primary/5" : "bg-card"} ${isMuted ? "opacity-60" : ""}`}>
      {collapse ? (
        <button
          type="button"
          aria-expanded={!collapse.isCollapsed}
          aria-label={`${collapse.isCollapsed ? "Expandir" : "Recolher"} ${title}`}
          onClick={collapse.onToggle}
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {collapse.isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      ) : (
        <span aria-hidden className="size-6 shrink-0" />
      )}
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className={`break-words text-sm leading-snug ${isRoot ? "font-semibold" : "font-medium"}`}>{title}</p>
        <p className="text-xs text-muted-foreground">
          {subtitle}
          {collapse?.isCollapsed ? ` · ${collapse.hiddenCount} ${collapse.hiddenCount === 1 ? "recolhido" : "recolhidos"}` : ""}
        </p>
      </div>
      {actions}
    </div>
  );
}

function describeMember(member: OrgChartMember): string {
  const parts = [member.kind, `${member.recordCount} ${member.recordCount === 1 ? "ficha" : "fichas"}`];
  if (member.isPromoted) parts.push("agora é lead");
  else if (member.isArchived) parts.push("arquivado");
  return parts.filter(Boolean).join(" · ");
}

function MemberBranchNode<Member extends OrgChartMember>({ node, renderActions }: { node: MemberTreeNode<Member>; renderActions?: (member: Member) => ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;
  return (
    <li className="space-y-2">
      {/* A linha curta fica presa ao cartão, e não ao item inteiro, para cair no meio da altura dele. */}
      <div className="relative">
        <span aria-hidden className="absolute -left-4 top-1/2 h-px w-4 bg-border" />
        <NodeCard
          title={node.name}
          subtitle={describeMember(node)}
          isMuted={node.isArchived || node.isPromoted}
          actions={renderActions?.(node)}
          collapse={
            hasChildren
              ? { isCollapsed, hiddenCount: countDescendants(node.children), onToggle: () => setIsCollapsed((current) => !current) }
              : undefined
          }
        />
      </div>
      {!isCollapsed && <Branch nodes={node.children} renderActions={renderActions} />}
    </li>
  );
}

function Branch<Member extends OrgChartMember>({ nodes, renderActions }: { nodes: MemberTreeNode<Member>[]; renderActions?: (member: Member) => ReactNode }) {
  if (nodes.length === 0) return null;
  return (
    <ul className="ml-4 space-y-2 border-l pl-4">
      {nodes.map((node) => (
        <MemberBranchNode key={node.id} node={node} renderActions={renderActions} />
      ))}
    </ul>
  );
}

export function LeadMemberOrgChart<Member extends OrgChartMember>({
  rootName,
  rootSubtitle,
  nodes,
  renderActions,
}: {
  rootName: string;
  rootSubtitle: string;
  nodes: MemberTreeNode<Member>[];
  renderActions?: (member: Member) => ReactNode;
}) {
  const [isRootCollapsed, setIsRootCollapsed] = useState(false);
  return (
    <div className="space-y-2">
      <NodeCard
        title={rootName}
        subtitle={rootSubtitle}
        isRoot
        collapse={
          nodes.length > 0
            ? { isCollapsed: isRootCollapsed, hiddenCount: countDescendants(nodes), onToggle: () => setIsRootCollapsed((current) => !current) }
            : undefined
        }
      />
      {!isRootCollapsed && <Branch nodes={nodes} renderActions={renderActions} />}
    </div>
  );
}
