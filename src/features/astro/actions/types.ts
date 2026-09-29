import "server-only";
import { z } from "zod";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroAppId } from "./apps";
import type { AppKey, OrgAction } from "@/features/permissions/lib/catalog";
import type { AstroPicker } from "@/features/astro/lib/astro-picker";

// Registro único de ações do Astro (spec 0023). Uma ação é declarada aqui e
// alcança as três superfícies — orquestrador, classificador e executor por
// regex — sem cópia. Antes desta camada, criar proposta existia só no regex e
// devolvia link interno; o orquestrador nem tinha a ferramenta.

/** Pergunta de um campo do roteiro, com o seletor que responde a ela. */
export interface AstroFieldStep {
  title: string;
  question: string;
  picker: AstroPicker;
}

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
      /** Rótulo do botão, ex: "Abrir Workspace". */
      openLabel?: string;
      appName: string;
    }
  | {
      status: "needs_input";
      title: string;
      description: string;
      missingFields: AstroMissingField[];
      appName: string;
      /** Busca ou seletor de data no cartão, no lugar de texto livre. */
      picker?: AstroPicker;
    }
  | {
      status: "ambiguous";
      title: string;
      description: string;
      field: string;
      options: AstroAmbiguousOption[];
      appName: string;
      /** Busca além das opções listadas (a certa pode não estar entre elas). */
      picker?: AstroPicker;
    }
  | {
      status: "error";
      title: string;
      description: string;
      /**
       * Erro também aponta caminho: “agenda já existe” sem link para a agenda
       * obriga a pessoa a procurar o que ela acabou de pedir.
       */
      internalUrl?: string;
      openLabel?: string;
      appName: string;
    };

/** A variante de escolha, para quem só aceita um cartão com `options`. */
export type AstroAmbiguousResult = Extract<AstroActionResult, { status: "ambiguous" }>;

export interface AstroAction<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  /** Identidade no registro e no `metadata.route` do UsageEvent. */
  key: string;
  /**
   * App a que a ação pertence (spec 0025, RF-1). A etapa 1 da triagem se monta
   * a partir daqui: app novo aparece sozinho, sem código novo.
   */
  app: AstroAppId;
  /** Nome exposto ao modelo como ferramenta. */
  toolName: string;
  /** Serve ao orquestrador e ao classificador — escreva pensando nos dois. */
  description: string;
  /**
   * Permissão exigida, na mesma matriz que o Master configura em Settings ›
   * Permissões. Obrigatória: o Astro é um caminho a mais para o que a tela já
   * faz, e um caminho a mais sem gate é um atalho para burlar o gate.
   */
  permission: { appKey: AppKey; action: OrgAction };
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
   * Campos deduzidos da própria frase, sem IA. Existe porque booleano
   * implícito no verbo ("favorita" = true, "desfavorita" = false) é regra
   * determinística: pedir ao modelo que o preencha briga com a instrução de
   * só extrair o que foi dito, e ele erra em boa parte das vezes.
   */
  inferFields?: (text: string) => Record<string, unknown>;
  /**
   * Campos que nomeiam algo NOVO. Faltando um deles, o Astro pergunta em vez
   * de listar o que já existe: oferecer os funis atuais a quem pediu um funil
   * novo é oferecer exatamente o que a pessoa não quer.
   */
  newNameFields?: string[];
  /**
   * Campos que só o código ou a resposta do usuário preenchem — o classificador
   * não os vê no catálogo. Existe porque o modelo inventa: pediu "amanhã" sem
   * hora e ele completou com 00:00 (spec 0033, RF-3).
   */
  codeOnlyFields?: string[];
  /**
   * Frases inequívocas deste verbo, sobre o texto sem acento e em minúsculas.
   * Casou só este verbo, o roteiro começa sem classificador: "quero agendar"
   * não precisa de modelo — e cada vez que ele escapava, o orquestrador
   * gastava ~23 mil tokens para perguntar o mesmo (spec 0033, RF-9).
   */
  intentPatterns?: RegExp[];
  /**
   * Como perguntar cada campo que faltar: título, pergunta e seletor. Sem
   * isto, o ciclo guiado perguntava "me diga: leadName" em texto aberto — e
   * a resposta livre voltava ao classificador (spec 0033, RF-9).
   */
  fieldSteps?: Record<string, AstroFieldStep>;
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

/** Campos que o classificador pode preencher — o catálogo mostra só estes. */
export function classifierFieldNames(action: AstroAction): string[] {
  const shape = action.input instanceof z.ZodObject ? action.input.shape : {};
  const codeOnly = new Set(action.codeOnlyFields ?? []);
  return Object.keys(shape).filter((field) => !codeOnly.has(field));
}
