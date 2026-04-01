"use client";
import { useListRecentMembers } from "@/features/workspace/hooks/use-workspace";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function RecentMembers() {
  const { data, isLoading } = useListRecentMembers(10);

  if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const members = data?.members ?? [];

  if (members.length === 0) {
    return (
      <div className="py-10 text-center text-muted-foreground italic">
        Nenhum novo membro adicionado recentemente.
      </div>
    );
  }

  return (
    <div className="flex flex-col pt-2">
      {members.map((member: any) => (
        <Item key={member.id} asChild>
          <Link href={`/workspaces/${member.workspace.id}`}>
            <ItemMedia>
              <Avatar className="size-8">
                <AvatarImage src={member.user.image || ""} />
                <AvatarFallback>{member.user.name.charAt(0)}</AvatarFallback>
              </Avatar>
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{member.user.name}</ItemTitle>
              <ItemDescription>
                Ficou membro de {member.workspace.name}
              </ItemDescription>
            </ItemContent>
            <ItemContent className="items-end">
              <span className="text-xs text-muted-foreground capitalize">
                {member.role.toLowerCase()}
              </span>
            </ItemContent>
          </Link>
        </Item>
      ))}
    </div>
  );
}
