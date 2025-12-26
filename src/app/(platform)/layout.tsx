import { ModalProvider } from "@/components/providers/modal-provider";
import { requireAuth } from "@/lib/auth-utils";

export default async function RouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  return (
    <>
      {/* <ModalProvider /> */}
      {children}
    </>
  );
}
