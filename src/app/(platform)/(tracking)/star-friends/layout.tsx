import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function StarFriendsLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("star-friends");
  return children;
}
