import type { EventCategory } from "@/generated/prisma/enums";

export interface PublicEvent {
  id: string;
  publicSlug: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  dueDate: Date | string | null;
  publishedAt: Date | string | null;
  eventCategory: EventCategory | null;
  country: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  registrationUrl: string | null;
  formId: string | null;
  viewCount: number;
  likesCount: number;
  shareCount: number;
  links: { title: string; url: string }[];
  attachments: { name: string; url: string; type?: string }[];
  youtubeUrl: string | null;
  // Sistema de reivindicação/denúncia — controla banner amarelo
  // "ownership contestado" e selo de marca verificada.
  isDisputed?: boolean;
  disputeReason?: string | null;
  organization?: {
    id: string;
    name: string;
    logo?: string | null;
    isVerified?: boolean;
  } | null;
  user?: {
    id: string;
    name: string;
    image: string | null;
  } | null;
  participants?: {
    user: {
      id: string;
      name: string;
      image: string | null;
    };
  }[];
  tags?: {
    tag: { id: string; name: string; color: string };
  }[];
}

export interface PublicEventFilters {
  country?: string;
  state?: string;
  city?: string;
  category?: EventCategory;
  from?: Date;
  to?: Date;
  search?: string;
}
