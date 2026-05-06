"use client";

import { ShieldCheck, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface Props {
  adminUser: { name: string; email: string; image: string | null };
}

export function AdminHeader({ adminUser }: Props) {
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
  };

  return (
    <header className="h-14 shrink-0 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-3 md:px-6 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <SidebarTrigger className="md:hidden text-zinc-300 hover:text-white -ml-1" />
        <ShieldCheck className="w-4 h-4 text-violet-400 shrink-0 hidden sm:block" />
        <span className="text-xs font-semibold text-violet-300 uppercase tracking-widest truncate">
          <span className="hidden sm:inline">Moderação do Sistema</span>
          <span className="sm:hidden">Admin</span>
        </span>
      </div>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-medium text-white leading-none truncate max-w-[160px]">{adminUser.name}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-[160px]">{adminUser.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
