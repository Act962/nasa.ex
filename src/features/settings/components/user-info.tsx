"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";

export function UserInfo() {
  const { data: session, isPending } = authClient.useSession();
  const { data: activeOrganization, isPending: isPendingOrganization } =
    authClient.useActiveOrganization();

  return (
    <div className="flex min-w-0 items-center gap-3">
      {isPending ? (
        <Skeleton className="size-10 rounded-full" />
      ) : (
        <Avatar className="size-10">
          {session?.user?.image && <AvatarImage src={session.user.image} />}
          <AvatarFallback>{session?.user?.name?.charAt(0)}</AvatarFallback>
        </Avatar>
      )}

      {isPending ? (
        <div className="space-y-1">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-4 w-12 rounded-full" />
        </div>
      ) : (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{session?.user?.name}</p>
          <span className="block truncate text-sm text-muted-foreground">
            {session?.user?.email}
          </span>
        </div>
      )}

      <Separator orientation="vertical" className="h-8! w-px!" />

      {isPendingOrganization ? (
        <div className="space-y-1">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-4 w-12 rounded-full" />
        </div>
      ) : (
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Empresa</p>
          <span className="block truncate text-sm text-muted-foreground">
            {activeOrganization?.name}
          </span>
        </div>
      )}
    </div>
  );
}
