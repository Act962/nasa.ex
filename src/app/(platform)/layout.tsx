import { requireAuth } from "@/lib/auth-utils";

export default async function RouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  return <div className="h-full">{children}</div>;
}
