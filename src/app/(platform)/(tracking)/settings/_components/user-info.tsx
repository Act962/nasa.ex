"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";

export function UserInfo() {
  const { data: session, isPending } = authClient.useSession();
  const { data: activeOrganization, isPending: isPendingActiveOrganization } =
    authClient.useActiveOrganization();

  return (
    <div>
      <div className="flex items-center gap-4 px-4 w-full max-w-7xl mx-auto">
        <Avatar className="size-12">
          {session?.user?.image && <AvatarImage src={session?.user?.image} />}
          <AvatarFallback>{session?.user?.name?.charAt(0)}</AvatarFallback>
        </Avatar>

        <div className="flex items-center gap-8">
          <div>
            <p className="text-sm font-medium text-foreground">
              {session?.user?.name}
            </p>
            <span className="text-sm text-foreground/50">
              {session?.user?.email}
            </span>
          </div>

          <Separator orientation="vertical" className="h-8! w-px! " />

          <div>
            <p className="text-sm font-medium text-foreground">Empresa</p>
            <span className="text-sm text-foreground/50">
              {activeOrganization?.name}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
