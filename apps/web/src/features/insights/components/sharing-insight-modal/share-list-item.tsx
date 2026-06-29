import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  ClockIcon,
  ExternalLinkIcon,
  LinkIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { DeleteInsight } from "./delete-insight";
import { Toaster } from "@/components/ui/sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ShareListItem({
  share,
  startDate,
  endDate,
}: {
  share: {
    id: string;
    name: string;
    token: string;
    createdAt: Date;
    organizationId: string;
    createdBy: { name: string; image: string | null };
  };
  startDate?: string | null;
  endDate?: string | null;
}) {
  const base = `${process.env.NEXT_PUBLIC_APP_URL}/insights/${share.organizationId}/${share.token}`;
  const params = new URLSearchParams();
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  const qs = params.toString();
  const shareUrl = qs ? `${base}?${qs}` : base;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copiado!");
  };

  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(share.createdAt));

  const initials = share.createdBy.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50">
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={share.createdBy.image ?? undefined} />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{share.name}</p>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
          <ClockIcon className="size-3 shrink-0" />
          <span>{formattedDate}</span>
          <span>·</span>
          <span className="truncate">{share.createdBy.name}</span>
        </div>
      </div>

      <div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={handleCopyLink}
              title="Copiar link"
            >
              <LinkIcon className="size-4" />
            </Button>
          </TooltipTrigger>

          <TooltipContent>
            <p>Copiar link</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              title="Copiar link"
            >
              <Link href={shareUrl}>
                <ExternalLinkIcon className="size-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Abrir link</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger>
            <DeleteInsight id={share.id}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                title="Copiar link"
              >
                <Trash2Icon />
              </Button>
            </DeleteInsight>
            <TooltipContent>
              <p>Deletar</p>
            </TooltipContent>
          </TooltipTrigger>
        </Tooltip>
      </div>
    </div>
  );
}
