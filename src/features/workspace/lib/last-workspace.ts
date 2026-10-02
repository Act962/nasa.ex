/** Último projeto (workspace) aberto neste navegador — a aba "Workspaces" do menu volta direto para ele. */

const LAST_WORKSPACE_STORAGE_KEY = "orbita:last-workspace-id";

export function rememberLastWorkspaceId(workspaceId: string) {
  try {
    window.localStorage.setItem(LAST_WORKSPACE_STORAGE_KEY, workspaceId);
  } catch {
    // Armazenamento bloqueado (aba anônima): a aba do menu abre a lista de projetos.
  }
}

export function readLastWorkspaceId(): string | null {
  try {
    return window.localStorage.getItem(LAST_WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function forgetLastWorkspaceId() {
  try {
    window.localStorage.removeItem(LAST_WORKSPACE_STORAGE_KEY);
  } catch {
    // Sem armazenamento, não há o que esquecer.
  }
}
