import "server-only";
import prisma from "@/lib/prisma";
import { sampleName } from "./helpers";
import type { SampleSeedContext } from "./types";

export async function seedSampleNBox(context: SampleSeedContext): Promise<void> {
  await prisma.nBoxFolder.create({
    data: {
      name: sampleName("Documentos da empresa"),
      color: "#6366f1",
      organizationId: context.organizationId,
      createdById: context.ownerUserId,
      items: {
        create: [
          {
            organizationId: context.organizationId,
            type: "LINK",
            name: sampleName("Consulta de CNPJ na Receita Federal"),
            url: "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp",
            description: "Atalho para emitir o comprovante de inscrição do CNPJ da empresa.",
            tags: ["empresa", "documentos"],
            createdById: context.ownerUserId,
          },
          {
            organizationId: context.organizationId,
            type: "LINK",
            name: sampleName("Manual da marca"),
            url: "https://www.example.com/manual-da-marca",
            description: "Guarde aqui o link do manual com logo, cores e fontes da empresa.",
            tags: ["marca"],
            createdById: context.ownerUserId,
          },
        ],
      },
    },
  });
}
