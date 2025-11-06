"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut({
      fetchOptions: {
        onRequest: () => {
          router.replace("/sign-in");
        },
      },
    });
  }

  return (
    <Button
      variant="destructive"
      className="cursor-pointer"
      onClick={handleLogout}
    >
      Sair
    </Button>
  );
}
