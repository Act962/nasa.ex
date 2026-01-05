import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTracking } from "@/hooks/use-tracking-modal";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDown, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export function TrackingSwitcher() {
  const params = useParams<{ trackingId: string }>();
  const { onOpen } = useTracking();
  const { data, isPending } = useQuery(orpc.tracking.list.queryOptions());

  const curretnTracking = data?.find(
    (tracking) => tracking.id === params.trackingId
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {curretnTracking?.name} <ChevronsUpDown className="ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Trackings</DropdownMenuLabel>
        {isPending && <DropdownMenuLabel>Carregando...</DropdownMenuLabel>}
        {!isPending &&
          data?.map((tracking) => (
            <DropdownMenuItem
              key={tracking.id}
              asChild
              className="cursor-pointer text-ellipsis"
            >
              <Link href={`/tracking/${tracking.id}`} prefetch>
                {tracking.name}
                {tracking.id === params.trackingId && (
                  <CheckIcon className="ml-auto h-4 w-4" />
                )}
              </Link>
            </DropdownMenuItem>
          ))}
        <DropdownMenuItem onClick={onOpen} className="cursor-pointer">
          <PlusIcon className="size-4" />
          Adicionar tracking
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
