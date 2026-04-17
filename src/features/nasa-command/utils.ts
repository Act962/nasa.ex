import { RECENT_KEY, RECENT_MAX } from "./data/constants";

export function loadRecentCommands(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveRecentCommand(cmd: string): string[] {
  const trimmed = cmd.trim();
  if (!trimmed) return loadRecentCommands();
  const prev = loadRecentCommands().filter((c) => c !== trimmed);
  const next = [trimmed, ...prev].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function buildHighlightedHTML(text: string): string {
  // Escape HTML first
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Highlight /variables (purple) and #apps (blue)
  return escaped.replace(/(\/[\w_ÀÀ-ÿ.]+|#[\w-]+)/g, (match) => {
    if (match.startsWith("/")) {
      return `<mark class="bg-transparent text-purple-400 font-medium">${match}</mark>`;
    }
    return `<mark class="bg-transparent text-blue-400 font-medium">${match}</mark>`;
  });
}

export function buildThinkingSteps(cmd: string): string[] {
  const lower = cmd.toLowerCase();
  const steps: string[] = ["Analisando o comando..."];

  if (lower.includes("#forge")) steps.push("Identificando app: Forge");
  if (lower.includes("#agenda")) steps.push("Identificando app: Agenda");
  if (lower.includes("#nasa-planner"))
    steps.push("Identificando app: NASA Planner");
  if (lower.includes("#nasa-post")) steps.push("Identificando app: NASA Post");
  if (lower.includes("#tracking")) steps.push("Identificando app: Tracking");

  const vars = [...cmd.matchAll(/\/([A-Za-zÀ-ÿ0-9_]+)/g)].map((m) => m[1]);
  vars.forEach((v) => {
    if (
      !["hoje", "amanhã", "amanha", "semana_que_vem"].includes(
        v.toLowerCase(),
      ) &&
      !v.startsWith("link_") &&
      !/^\d/.test(v)
    ) {
      steps.push(`Resolvendo variável /${v}...`);
    }
  });

  if (lower.includes("proposta")) steps.push("Criando proposta no Forge...");
  if (lower.includes("contrato")) steps.push("Criando contrato no Forge...");
  if (
    lower.includes("reunião") ||
    lower.includes("follow-up") ||
    lower.includes("agende")
  )
    steps.push("Criando agendamento...");
  if (lower.includes("post") || lower.includes("carrossel"))
    steps.push("Criando post no NASA Planner...");
  if (lower.includes("tracking") && lower.includes("crie"))
    steps.push("Criando tracking...");
  if (lower.includes("lead") && lower.includes("crie"))
    steps.push("Criando lead...");
  if (lower.includes("saldo") || lower.includes("estrelas"))
    steps.push("Consultando saldo de Stars...");
  if (
    lower.includes("quantos") ||
    lower.includes("quais") ||
    lower.includes("liste")
  )
    steps.push("Buscando dados...");

  steps.push("Finalizando...");
  return steps;
}
