import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function ContatosLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("contatos");
  return children;
}
