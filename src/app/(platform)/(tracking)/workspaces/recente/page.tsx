import { OpenLastWorkspace } from "@/features/workspace/components/open-last-workspace";

/** Aba "Workspaces" do menu: abre o último projeto aberto; sem nenhum, a lista de projetos. */
export default function Page() {
  return <OpenLastWorkspace />;
}
