export interface OrgMemberRow {
  id: string;
  role: string;
  cargo: string | null;
  createdAt: Date | string;
  userId: string;
  user: { id: string; name: string; email: string; image: string | null };
}

export function formatJoinedAt(createdAt: Date | string): string {
  return new Date(createdAt).toLocaleDateString("pt-BR");
}

export function toMemberInitial(name: string | null | undefined): string {
  return name?.split(" ")[0]?.[0]?.toUpperCase() ?? "?";
}
