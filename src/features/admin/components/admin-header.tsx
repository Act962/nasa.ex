"use client";

import { useState } from "react";
import { ShieldCheck, LogOut, MenuIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AdminSidebar } from "./admin-sidebar";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { PushToggle } from "@/features/notifications/components/push-toggle";

interface Props {
  adminUser: { name: string; email: string; image: string | null };
}

export function AdminHeader({ adminUser }: Props) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
  };

  return (
    <header className="h-14 shrink-0 bg-background flex items-center justify-between gap-3 px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Abrir menu"
              className="grid size-9 place-items-center rounded-full bg-knob text-foreground md:hidden"
            >
              <MenuIcon className="size-4" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Menu do admin</SheetTitle>
            <AdminSidebar className="h-full w-full border-r-0" onNavigate={() => setIsMenuOpen(false)} />
          </SheetContent>
        </Sheet>
        <ShieldCheck className="hidden w-4 h-4 text-muted-foreground sm:block" />
        <span className="hidden truncate text-xs font-semibold text-muted-foreground uppercase tracking-widest sm:inline">
          Moderação do Sistema
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Opt-in de push deste dispositivo. Some sozinho onde não há suporte. */}
        <PushToggle />
        <div className="hidden text-right sm:block">
          <p className="text-xs font-medium text-foreground leading-none">{adminUser.name}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{adminUser.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
