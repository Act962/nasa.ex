"use client";

import { ShieldCheck, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

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
    <header className="h-14 shrink-0 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-violet-400" />
        <span className="text-xs font-semibold text-violet-300 uppercase tracking-widest">
          Moderação do Sistema
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs font-medium text-white leading-none">{adminUser.name}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">{adminUser.email}</p>
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
