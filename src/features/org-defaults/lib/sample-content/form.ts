import "server-only";
import { defaultBackgroundColor, defaultPrimaryColor } from "@/features/form/constants";
import type { FormBlockInstance } from "@/features/form/types";
import prisma from "@/lib/prisma";
import { sampleName } from "./helpers";
import type { SampleSeedContext } from "./types";

function buildContactFormBlocks(): FormBlockInstance[] {
  return [
    {
      id: `layout-${crypto.randomUUID()}`,
      blockType: "RowLayout",
      isLocked: false,
      attributes: {},
      childblocks: [
        {
          id: crypto.randomUUID(),
          blockType: "Heading",
          attributes: { label: "Fale com a gente", level: 1, fontSize: "2x-large", fontWeight: "bold" },
        },
        {
          id: crypto.randomUUID(),
          blockType: "TextField",
          attributes: { label: "Nome", helperText: "", required: true, placeHolder: "Seu nome completo" },
        },
        {
          id: crypto.randomUUID(),
          blockType: "MaskedField",
          attributes: {
            label: "Telefone com DDD",
            helperText: "",
            required: true,
            placeHolder: "(00) 00000-0000",
            format: "phone-br",
            validateCep: false,
            validateCpf: false,
          },
        },
        {
          id: crypto.randomUUID(),
          blockType: "Dropdown",
          attributes: {
            label: "Qual é o seu interesse?",
            helperText: "",
            placeholder: "Selecione uma opção",
            required: false,
            options: [
              { id: "opt-orcamento", label: "Pedir um orçamento" },
              { id: "opt-duvida", label: "Tirar uma dúvida" },
              { id: "opt-parceria", label: "Proposta de parceria" },
            ],
          },
        },
      ],
    },
  ];
}

export async function seedSampleForm(context: SampleSeedContext): Promise<void> {
  const serializedBlocks = JSON.stringify(buildContactFormBlocks());

  await prisma.form.create({
    data: {
      name: sampleName("Formulário de contato"),
      description: "Capte nome, telefone e interesse dos visitantes do seu site ou Instagram.",
      userId: context.ownerUserId,
      organizationId: context.organizationId,
      jsonBlock: serializedBlocks,
      content: serializedBlocks,
      published: false,
      shareUrl: crypto.randomUUID(),
      settings: {
        create: {
          primaryColor: defaultPrimaryColor,
          backgroundColor: defaultBackgroundColor,
        },
      },
    },
  });
}
