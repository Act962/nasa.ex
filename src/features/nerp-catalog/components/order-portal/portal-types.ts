import type { useCatalogOrderPortal, useCatalogOrderStarFriends } from "../../hooks/use-catalog-order-portal";

export type PortalOrder = NonNullable<ReturnType<typeof useCatalogOrderPortal>["data"]>;

type StarFriendsResult = NonNullable<ReturnType<typeof useCatalogOrderStarFriends>["data"]>;
export type PortalStarFriends = Extract<StarFriendsResult, { isActive: true }>;

export type PortalTab = "offers" | "home" | "chat" | "more";

export type PortalMoreScreen = "journey" | "history" | "orders" | "redemptions" | "how" | "data" | "rules" | "help";
