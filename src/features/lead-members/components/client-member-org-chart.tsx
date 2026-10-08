"use client";

import Link from "next/link";
import { Building2, UserRound } from "lucide-react";
import { buildMemberTree, type MemberTreeNode } from "@/features/lead-members/lib/member-tree";

// Organograma da página do cliente (spec 0076, RF-12): o titular em cima e os
// vinculados abaixo, cada nó com link para as próprias fichas. Em tela larga é
// uma árvore de cima para baixo; no celular, uma lista recuada com as linhas.

export interface ClientChartMember {
  id: string;
  parentMemberId: string | null;
  name: string;
  kind: string | null;
  isPromoted: boolean;
  recordCount: number;
  totalCents: number;
}

type ChartNode = MemberTreeNode<ClientChartMember>;

const formatMoney = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatRecordCount = (recordCount: number) => `${recordCount} ${recordCount === 1 ? "ficha" : "fichas"}`;

// As linhas da árvore usam pseudo-elementos, que o Tailwind não expressa de forma legível.
const TREE_STYLES = `
.member-tree ul { display: flex; justify-content: center; padding-top: 20px; position: relative; }
.member-tree li { position: relative; padding: 20px 8px 0; display: flex; flex-direction: column; align-items: center; }
.member-tree li::before, .member-tree li::after { content: ""; position: absolute; top: 0; right: 50%; width: 50%; height: 20px; border-top: 1px solid var(--border); }
.member-tree li::after { right: auto; left: 50%; border-left: 1px solid var(--border); }
.member-tree li:only-child::before, .member-tree li:only-child::after { border-top: 0; }
.member-tree li:first-child::before, .member-tree li:last-child::after { border-top: 0; }
.member-tree li:last-child::before { border-right: 1px solid var(--border); }
.member-tree li:last-child::after { border-left: 0; }
.member-tree li:only-child::before { border-right: 1px solid var(--border); }
.member-tree ul ul::before { content: ""; position: absolute; top: 0; left: 50%; height: 20px; border-left: 1px solid var(--border); }
.member-tree > ul { padding-top: 0; }
.member-tree > ul > li { padding-top: 0; }
.member-tree > ul > li::before, .member-tree > ul > li::after { display: none; }
`;

function NodeBox({
  title,
  subtitle,
  href,
  isRoot,
  isSelected,
  isMuted,
}: {
  title: string;
  subtitle: string;
  href: string | null;
  isRoot?: boolean;
  isSelected: boolean;
  isMuted?: boolean;
}) {
  const Icon = isRoot ? Building2 : UserRound;
  const className = `flex w-full min-w-36 max-w-56 items-center gap-2 rounded-md border px-3 py-2 text-left ${
    isSelected ? "border-primary bg-primary/10" : isRoot ? "border-primary/40 bg-primary/5" : "bg-card"
  } ${href ? "hover:bg-accent" : ""} ${isMuted ? "opacity-60" : ""}`;
  const content = (
    <>
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className={`block break-words text-sm leading-snug ${isRoot ? "font-semibold" : "font-medium"}`}>{title}</span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </>
  );
  return href ? (
    <Link href={href} aria-current={isSelected ? "page" : undefined} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function describeMember(member: ClientChartMember): string {
  if (member.isPromoted) return "agora cliente próprio";
  const parts = [member.kind, formatRecordCount(member.recordCount)];
  if (member.totalCents > 0) parts.push(formatMoney(member.totalCents));
  return parts.filter(Boolean).join(" · ");
}

export function ClientMemberOrgChart({
  token,
  clientName,
  rootSubtitle,
  members,
  selectedMemberId,
}: {
  token: string;
  clientName: string;
  rootSubtitle: string;
  members: ClientChartMember[];
  selectedMemberId: string | null;
}) {
  if (members.length === 0) return null;
  const rootHref = `/lead/${token}/fichas`;
  const memberHref = (member: ClientChartMember) => (member.isPromoted ? null : `/lead/${token}/fichas?vinculado=${member.id}`);
  const tree = buildMemberTree(members);

  const renderTreeNodes = (nodes: ChartNode[]) => (
    <ul>
      {nodes.map((node) => (
        <li key={node.id}>
          <NodeBox title={node.name} subtitle={describeMember(node)} href={memberHref(node)} isSelected={selectedMemberId === node.id} isMuted={node.isPromoted} />
          {node.children.length > 0 && renderTreeNodes(node.children)}
        </li>
      ))}
    </ul>
  );

  const renderListNodes = (nodes: ChartNode[]) => (
    <ul className="ml-4 space-y-2 border-l pl-4">
      {nodes.map((node) => (
        <li key={node.id} className="space-y-2">
          <div className="relative">
            <span aria-hidden className="absolute -left-4 top-1/2 h-px w-4 bg-border" />
            <NodeBox title={node.name} subtitle={describeMember(node)} href={memberHref(node)} isSelected={selectedMemberId === node.id} isMuted={node.isPromoted} />
          </div>
          {node.children.length > 0 && renderListNodes(node.children)}
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-label="Organograma" className="rounded-md border p-4">
      <style>{TREE_STYLES}</style>
      <div className="member-tree hidden overflow-x-auto sm:block">
        <ul>
          <li>
            <NodeBox title={clientName} subtitle={rootSubtitle} href={rootHref} isRoot isSelected={selectedMemberId === null} />
            {renderTreeNodes(tree)}
          </li>
        </ul>
      </div>
      <div className="space-y-2 sm:hidden">
        <NodeBox title={clientName} subtitle={rootSubtitle} href={rootHref} isRoot isSelected={selectedMemberId === null} />
        {renderListNodes(tree)}
      </div>
    </section>
  );
}
