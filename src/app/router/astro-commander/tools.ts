import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import { resolveToolSetForScope } from "@/features/astro/server/tool-scope";
import {
  isFinancialTool,
} from "@/features/astro-commander/lib/guardrails";
import { isMutatingTool } from "@/features/astro-commander/server/tool-guard";
import { isAccountingToolName } from "@/features/astro/server/tools/accounting/tool-names";

/**
 * Catálogo de ferramentas para a aba Ações (spec 0028, RF-22). As opções vêm
 * do próprio registry do ASTRO: ferramenta que sai do código some da tela
 * sozinha, em vez de virar um toggle que não faz nada.
 */

/** Grupos por prefixo — o suficiente para a tela não virar uma lista crua. */
const GROUPS: Array<{ label: string; test: (name: string) => boolean }> = [
  // Antes dos prefixos: "list_company_documents" e "list_tax_rates" cairiam em "Outras".
  { label: "Contábil", test: (name) => isAccountingToolName(name) },
  { label: "Leads e funis", test: (name) => /lead|tracking|status|tag|pipeline/.test(name) },
  { label: "Conversas", test: (name) => /chat|message|whatsapp|conversation/.test(name) },
  { label: "Agenda", test: (name) => /agenda|appointment|schedule|reminder|calendar/.test(name) },
  { label: "Financeiro", test: (name) => isFinancialTool(name) },
  { label: "Propostas", test: (name) => /proposal|forge|contract/.test(name) },
  { label: "Formulários", test: (name) => /form/.test(name) },
  { label: "Relatórios", test: (name) => /chart|report|insight|analytic|metric/.test(name) },
  { label: "Automações", test: (name) => /workflow|automation|alert/.test(name) },
];

function groupOf(toolName: string): string {
  return GROUPS.find((group) => group.test(toolName))?.label ?? "Outras";
}

export const listCommandTools = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const scope = resolveToolSetForScope("full", {
      userId: context.user.id,
      organizationId: context.org.id,
      route: {},
      restrictToOrgId: context.org.id,
      channel: "CHAT",
    });

    const tools = Object.entries(scope.tools)
      .map(([name, definition]) => ({
        name,
        description:
          (definition as { description?: string }).description?.slice(0, 200) ?? "",
        group: groupOf(name),
        mutating: isMutatingTool(name),
        // Financeira nunca roda sozinha, em nenhum modo (RF-4).
        alwaysRequiresApproval: isFinancialTool(name),
      }))
      .sort((left, right) =>
        left.group === right.group
          ? left.name.localeCompare(right.name)
          : left.group.localeCompare(right.group),
      );

    return { tools };
  });
