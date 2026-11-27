import { requireAppView } from "@/features/permissions/server/require-app-view";

export default async function PaymentLayout({ children }: { children: React.ReactNode }) {
  await requireAppView("payment");
  return children;
}
