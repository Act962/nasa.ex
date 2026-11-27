import type { ProposalLook } from "@/features/forge/lib/proposal-look";

export interface DocumentProduct {
  id: string;
  quantity: string;
  unitValue: string;
  discount: string | null;
  description: string | null;
  product: {
    id: string;
    name: string;
    unit: string;
    imageUrl: string | null;
    description: string | null;
  };
}

export interface SimulationBreakdown {
  recurring: { label: string; monthly: number }[];
  oneTime: { label: string; amount: number }[];
  termMonths: number;
  validityLabel: string;
  monthlyTotal: number;
  oneTimeTotal: number;
  contractTotal: number;
}

export interface DocumentProposal {
  title: string;
  number: number;
  status: string;
  description: string | null;
  validUntil: string | null;
  createdAt: string | null;
  discount: string | null;
  discountType: string | null;
  paymentLink: string | null;
  breakdown: SimulationBreakdown | null;
  products: DocumentProduct[];
  organization: {
    name: string;
    logo: string | null;
    cnpj: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    addressLine: string | null;
    city: string | null;
    state: string | null;
    website: string | null;
  };
  client: {
    name: string;
    email: string | null;
    phone: string | null;
    document: string | null;
  } | null;
  responsible: { name: string; image: string | null } | null;
}

export interface DocumentState {
  isExpired: boolean;
  isPaid: boolean;
  token: string;
  /** Prévia da tela de configurações: botões não levam a lugar nenhum. */
  isPreview: boolean;
}

export interface SectionProps {
  proposal: DocumentProposal;
  look: ProposalLook;
  state: DocumentState;
}
