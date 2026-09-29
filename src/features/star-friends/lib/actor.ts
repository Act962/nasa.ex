import type { LoyaltyActorType } from "@/generated/prisma/enums";

export type LoyaltyActor = {
  type: LoyaltyActorType;
  userId: string | null;
  name: string;
  email?: string | null;
  image?: string | null;
};

export const SYSTEM_ACTOR: LoyaltyActor = { type: "SYSTEM", userId: null, name: "STAR FRIENDS" };
export const ASTRO_ACTOR: LoyaltyActor = { type: "ASTRO", userId: null, name: "Astro" };

export function userActor(user: { id: string; name: string; email?: string | null; image?: string | null }): LoyaltyActor {
  return { type: "USER", userId: user.id, name: user.name, email: user.email, image: user.image };
}

export function customerActor(name: string): LoyaltyActor {
  return { type: "CUSTOMER", userId: null, name };
}
