/**
 * Calcula a "prontidão" do formulário pra publicação.
 *
 * Olha cada bloco (layout + childblocks) e retorna a lista de problemas
 * encontrados (ex: bloco sem label, Radio sem opções, Imagem sem URL).
 * O score = (blocosOk / blocosTotal) * 100.
 *
 * Antes essa lógica não existia — o user via "publicar" sem entender por
 * que nada chegava a 100%. Agora um badge + checklist no header do
 * builder destaca os blocos quebrados em vermelho.
 */

import type { FormBlockInstance } from "@/features/form/types";

export interface BlockProblem {
  blockId: string;
  /** Tipo do bloco (RadioSelect, ImageDisplay, Heading, etc.). */
  blockType: string;
  /** Mensagem amigável do problema. */
  message: string;
}

export interface FormReadiness {
  totalChecks: number;
  passed: number;
  percent: number;            // 0-100
  problems: BlockProblem[];
  invalidIds: Set<string>;    // IDs (layout ou child) com problema → highlight vermelho
}

/** Checagens por blockType — retorna mensagem do problema OU null se OK. */
function checkBlock(block: FormBlockInstance): string | null {
  const attrs = (block.attributes ?? {}) as Record<string, unknown>;

  switch (block.blockType) {
    // Fields que exigem `label` mínimo
    case "TextField":
    case "TextArea":
    case "Url":
    case "DatePicker":
    case "Slider":
    case "MaskedField":
    case "FileUpload":
    case "ImageUpload":
    case "SignatureUser":
    case "SignatureClient":
    case "Checkbox": {
      const label = (attrs.label as string | undefined)?.trim();
      if (!label) return "Defina um título pro campo.";
      return null;
    }

    // Blocos com opções
    case "RadioSelect":
    case "Dropdown":
    case "RadioMatrix": {
      const label = (attrs.label as string | undefined)?.trim();
      if (!label) return "Defina um título pro campo.";
      const options = (attrs.options as Array<{ value?: string }> | undefined) ?? [];
      if (options.length < 2)
        return "Adicione pelo menos 2 opções.";
      if (options.some((o) => !o.value?.trim()))
        return "Toda opção precisa de um texto.";
      return null;
    }

    // Imagem decorativa precisa de URL
    case "ImageDisplay": {
      const url = (attrs.url as string | undefined)?.trim();
      if (!url) return "Faça upload ou cole a URL da imagem.";
      return null;
    }

    // Heading e textos decorativos precisam de conteúdo
    case "Heading": {
      const text = (attrs.text as string | undefined)?.trim();
      if (!text) return "Defina o texto do título.";
      return null;
    }
    case "ParagraphWithTitle":
    case "Paragraph": {
      const text =
        (attrs.text as string | undefined)?.trim() ??
        (attrs.content as string | undefined)?.trim() ??
        "";
      if (!text) return "Adicione o conteúdo do parágrafo.";
      return null;
    }

    // Decorativos sem checagem
    case "PageBreak":
    case "RowLayout":
      return null;

    default:
      // Blocos novos/desconhecidos exigem só label se existir
      if ("label" in attrs) {
        const label = (attrs.label as string | undefined)?.trim();
        if (!label) return "Defina um título pro campo.";
      }
      return null;
  }
}

export function computeFormReadiness(
  blockLayouts: FormBlockInstance[],
): FormReadiness {
  const problems: BlockProblem[] = [];
  const invalidIds = new Set<string>();
  let totalChecks = 0;
  let passed = 0;

  // Form vazio → não-publicável
  if (!blockLayouts || blockLayouts.length === 0) {
    return {
      totalChecks: 1,
      passed: 0,
      percent: 0,
      problems: [
        {
          blockId: "__empty__",
          blockType: "__empty__",
          message: "Adicione pelo menos um bloco ao formulário.",
        },
      ],
      invalidIds: new Set<string>(["__empty__"]),
    };
  }

  function visit(block: FormBlockInstance, parentId?: string) {
    totalChecks += 1;
    const problem = checkBlock(block);
    if (problem) {
      problems.push({ blockId: block.id, blockType: block.blockType, message: problem });
      invalidIds.add(block.id);
      // marca o parent também pra evidenciar visualmente
      if (parentId) invalidIds.add(parentId);
    } else {
      passed += 1;
    }
    block.childblocks?.forEach((c) => visit(c, block.id));
  }

  blockLayouts.forEach((b) => visit(b));

  const percent =
    totalChecks === 0 ? 0 : Math.round((passed / totalChecks) * 100);

  return { totalChecks, passed, percent, problems, invalidIds };
}
