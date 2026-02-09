export interface LeadFull {
  lead: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    description: string | null;
    profile: string | null;
    statusId: string;
    order: number;
    trackingId: string;
    createdAt: Date;
    updatedAt: Date;
    status: {
      id: string;
      name: string;
      trackingId: string;
      order: number;
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
  };
}
