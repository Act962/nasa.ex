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
    <div>
      <div className="flex items-center gap-4 px-4 w-full max-w-7xl mx-auto">
        {isPending && <Skeleton className="h-12 w-12 rounded-full" />}
        {!isPending && (
          <Avatar className="size-12">
            {session?.user?.image && <AvatarImage src={session?.user?.image} />}
            <AvatarFallback>{session?.user?.name?.charAt(0)}</AvatarFallback>
          </Avatar>
        )}

        <div className="flex items-center gap-8">
          {isPending && (
            <div className="space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-12" />
            </div>
          )}
          {!isPending && (
            <div>
              <p className="text-sm font-medium text-foreground">
                {session?.user?.name}
              </p>
              <span className="text-sm text-foreground/50">
                {session?.user?.email}
              </span>
            </div>
          )}

          <Separator orientation="vertical" className="h-8! w-px! " />

          <div>
            {isPendingOrganization && (
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-12" />
              </div>
            )}
            {!isPendingOrganization && (
              <div>
                <p className="text-sm font-medium text-foreground">Empresa</p>
                <span className="text-sm text-foreground/50">
                  {activeOrganization?.name}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
