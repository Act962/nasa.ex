export interface LeadFull {
  lead: {
    id: string;
    name: string;
    nickname: string | null;
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
