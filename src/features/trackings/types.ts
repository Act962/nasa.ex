import { Temperature } from "@/generated/prisma/enums";

export type Lead = {
  order: string;
  id: string;
  trackingId: string;
  isActive: boolean;
  email: string | null;
  name: string;
  profile: string | null;
  statusId: string;
  createdAt: Date;
  description: string | null;
  phone: string | null;
  responsible: {
    image: string | null;
    name: string;
  } | null;
  leadTags: {
    tag: {
      id: string;
      name: string;
      color: string | null;
      slug: string;
    };
  }[];
  temperature: Temperature;
};
