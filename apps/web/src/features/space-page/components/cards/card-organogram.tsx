"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { SpaceCard } from "../space-card";
import { Badge } from "@/components/ui/badge";
import { UserProfileDropdown } from "../user-profile-dropdown";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CardOrganogramProps {
  nick: string;
}

interface ChartNode {
  id: string;
  parentId: string | null;
  department: string | null;
  customLabel: string | null;
  jobTitle: { id: string; title: string; category: string; level: number };
  user: { id: string; displayName: string | null; image: string | null } | null;
  isOpenPosition: boolean;
}

interface TreeNode extends ChartNode {
  children: TreeNode[];
}

function buildTree(nodes: ChartNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  nodes.forEach((n) => map.set(n.id, { ...n, children: [] }));
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export function CardOrganogram({ nick }: CardOrganogramProps) {
  const { data, isLoading } = useQuery(
    orpc.public.space.getOrgChart.queryOptions({ input: { nick } }),
  );

  const tree = useMemo(() => buildTree(data?.nodes ?? []), [data]);

  return (
    <SpaceCard
      title="Organograma"
      subtitle="Hierarquia pública da empresa (apenas membros com consent)"
      isEmpty={!isLoading && tree.length === 0}
      empty="A empresa ainda não montou o organograma público."
    >
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-16 animate-pulse rounded-xl bg-white/5" />
          <div className="h-16 animate-pulse rounded-xl bg-white/5" />
        </div>
      ) : (
        <ul className="space-y-2">
          {tree.map((node) => (
            <OrgNode key={node.id} node={node} depth={0} />
          ))}
        </ul>
      )}
    </SpaceCard>
  );
}

function OrgNode({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const [showProfile, setShowProfile] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div
        className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-2"
        style={{ marginLeft: depth * 16 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex size-6 shrink-0 items-center justify-center rounded text-white/60 hover:bg-white/10"
          >
            {open ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}

        <div className="relative size-8 shrink-0 overflow-hidden rounded-full bg-white/10">
          {node.user?.image ? (
            <Image
              src={node.user.image}
              alt={node.user.displayName ?? ""}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-white/60">
              {node.isOpenPosition
                ? "?"
                : node.user?.displayName?.[0] ?? "•"}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            node.user && !node.isOpenPosition && setShowProfile((s) => !s)
          }
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-sm text-white">
            {node.isOpenPosition ? (
              <span className="text-orange-300">Vaga aberta</span>
            ) : (
              node.user?.displayName ?? "Aguardando confirmação"
            )}
          </p>
          <p className="truncate text-xs text-white/60">
            {node.jobTitle.title}
            {node.customLabel ? ` · ${node.customLabel}` : ""}
            {node.department ? ` · ${node.department}` : ""}
          </p>
        </button>

        {node.isOpenPosition && (
          <Badge
            variant="outline"
            className="shrink-0 border-orange-500/30 text-[10px] text-orange-300"
          >
            Aberta
          </Badge>
        )}
      </div>

      {showProfile && node.user && (
        <UserProfileDropdown
          userId={node.user.id}
          onClose={() => setShowProfile(false)}
        />
      )}

      {open && hasChildren && (
        <ul className="mt-2 space-y-2">
          {node.children.map((c) => (
            <OrgNode key={c.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
