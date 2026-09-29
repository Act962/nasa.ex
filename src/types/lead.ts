import type { LeadMetricsView } from "@/features/leads/components/lead-audit/metric-format";

export interface LeadFull {
  lead: {
    id: string;
    name: string;
    nickname: string | null;
    metrics?: LeadMetricsView | null;
    addressZipCode?: string | null;
    addressStreet?: string | null;
    addressNumber?: string | null;
    addressComplement?: string | null;
    addressNeighborhood?: string | null;
    addressCity?: string | null;
    addressState?: string | null;
    addressCountry?: string | null;
    email: string | null;
    phone: string | null;
    description: string | null;
    profile: string | null;
    statusId: string;
    amount: number;
    trackingId: string;
    orgProjectId: string | null;
    temperature: "COLD" | "WARM" | "HOT" | "VERY_HOT";
    createdAt: Date;
    updatedAt: Date;
    status: {
      id: string;
      name: string;
      trackingId: string;
      order: string;
      color: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    tracking: {
      id: string;
      name: string;
      organizationId: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    responsible: {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      email: string;
      emailVerified: boolean;
      name: string;
      image: string | null;
    } | null;
    tags: {
      id: string;
      name: string;
      color: string | null;
      createdAt: Date;
      updatedAt: Date;
    }[];
    conversation:
      | {
          id: string;
        }
      | null
      | undefined;
  };
}
