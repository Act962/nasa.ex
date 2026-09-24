import "server-only";
import type { z } from "zod";
import type { AgentContext } from "@/features/astro/server/agents/types";

// Registro único de ações do Astro (spec 0023). Uma ação é declarada aqui e
// alcança as três superfícies — orquestrador, classificador e executor por
// regex — sem cópia. Antes desta camada, criar proposta existia só no regex e
// devolvia link interno; o orquestrador nem tinha a ferramenta.

/** Campo que faltou para a ação rodar. Vira pergunta no chat e no ciclo falado. */
export interface AstroMissingField {
  key: string;
  label: string;
}

/** Candidato quando a resolução por nome encontra mais de um registro. */
export interface AstroAmbiguousOption {
  id: string;
  label: string;
}

export type AstroActionResult =
  | {
      status: "done";
      title: string;
      description: string;
      /** Link para mandar ao cliente. É este que o cartão destaca. */
      publicUrl?: string;
      /** Link de dentro da plataforma, para quem vai editar. */
      internalUrl?: string;
      appName: string;
    }
  | {
      status: "needs_input";
      title: string;
      description: string;
      missingFields: AstroMissingField[];
      appName: string;
    }
  | {
      status: "ambiguous";
      title: string;
      description: string;
      field: string;
      options: AstroAmbiguousOption[];
      appName: string;
    }
  | {
      status: "error";
      title: string;
      description: string;
      appName: string;
    };

export interface AstroAction<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  /** Identidade no registro e no `metadata.route` do UsageEvent. */
  key: string;
  /** Nome exposto ao modelo como ferramenta. */
  toolName: string;
  /** Serve ao orquestrador e ao classificador — escreva pensando nos dois. */
  description: string;
  /**
   * Ação de escrita passa pela confirmação da spec 0014 antes de gravar.
   * Obrigatório em exclusão: o registro devolve o cartão e só grava no "sim".
   */
  requiresConfirmation: boolean;
  /** Título do cartão de confirmação. Sem isso, usa o nome da ferramenta. */
  confirmTitle?: string;
  /** Avisos exibidos em destaque no cartão — use em ação destrutiva. */
  confirmWarnings?: string[];
  input: TSchema;
  /**
   * `dryRun` resolve o alvo, checa permissão e devolve o que ACONTECERIA —
   * sem escrever. É o que impede a confirmação de propor o impossível: sem
   * isso, o cartão perguntava "excluir o lead X?" antes de saber se X existe,
   * e a checagem de homônimo só rodaria depois do "sim".
   */
  execute: (params: {
    ctx: AgentContext;
    input: z.infer<TSchema>;
    dryRun?: boolean;
  }) => Promise<AstroActionResult>;
}
