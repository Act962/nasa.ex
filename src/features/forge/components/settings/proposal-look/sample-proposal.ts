import type { DocumentProposal } from "@/features/forge/components/public/proposal-document/types";

/** Proposta de exemplo da prévia: dados fixos, com o nome e a logo da empresa (spec 0150, RF-9). */
export function buildSampleProposal(organization: { name: string; logo: string | null }): DocumentProposal {
  const today = new Date();
  const validUntil = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
  const product = (id: string, name: string, description: string, quantity: number, unitValue: number, discount: number) => ({
    id,
    quantity: String(quantity),
    unitValue: String(unitValue),
    discount: discount > 0 ? String(discount) : null,
    description: null,
    product: { id, name, unit: "un", imageUrl: null, description },
  });
  return {
    title: "Proposta comercial — Cliente Exemplo",
    number: 128,
    status: "ENVIADA",
    description: "<p>Proposta preparada para atender às necessidades do cliente, com implantação e suporte.</p>",
    validUntil: validUntil.toISOString(),
    createdAt: today.toISOString(),
    discount: null,
    discountType: null,
    paymentLink: "https://exemplo",
    breakdown: null,
    products: [
      product("exemplo-1", "Produto principal", "Descrição curta do produto", 2, 5000, 1500),
      product("exemplo-2", "Serviço de implantação", "Instalação, configuração e treinamento", 1, 1200, 0),
      product("exemplo-3", "Suporte mensal", "Atendimento por WhatsApp em horário comercial", 1, 400, 80),
    ],
    organization: {
      name: organization.name,
      logo: organization.logo,
      cnpj: "00.000.000/0001-00",
      contactEmail: "contato@suaempresa.com.br",
      contactPhone: "(86) 99999-0000",
      addressLine: null,
      city: null,
      state: null,
      website: null,
    },
    client: { name: "Cliente Exemplo", email: null, phone: null, document: null },
    responsible: { name: "Seu nome", image: null },
  };
}
