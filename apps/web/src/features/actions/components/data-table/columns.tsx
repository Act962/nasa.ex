import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ActionPriority } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { getContrastColor } from "@/utils/get-contrast-color";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDownIcon, CheckCircle2Icon } from "lucide-react";
import { CardActionsMenu } from "../card-actions-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type Action = {
  id: string;
  createdAt: Date;
  description: string | null;
  isArchived: boolean;
  isFavorited: boolean;
  isFavoritedByMe?: boolean;
  workspaceId: string;
  participants: {
    user: {
      id: string;
      name: string;
      image: string | null;
    };
  }[];
  subActions: {
    id: string;
    isDone: boolean;
  }[];
  title: string;
  isDone: boolean;
  createdBy: string;
  startDate: Date | null;
  priority: ActionPriority;
  dueDate: Date | null;
  column: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  columnId: string | null;
};

const priorityColors = {
  [ActionPriority.NONE]: "",
  [ActionPriority.URGENT]: "bg-red-500/10",
  [ActionPriority.HIGH]: "bg-red-500/10",
  [ActionPriority.MEDIUM]: "bg-yellow-500/10",
  [ActionPriority.LOW]: "bg-green-500/10",
} as const;

export const columns: ColumnDef<Action>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Título
        <ArrowUpDownIcon className="size-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="font-semibold line-clamp-1 hover:underline underline-offset-4 ">
            {row.original.title.substring(0, 40).concat("...")}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{row.original.title}</p>
        </TooltipContent>
      </Tooltip>
    ),
  },
  {
    accessorKey: "dueDate",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Data de vencimento
        <ArrowUpDownIcon className="size-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div>
        {row.original.dueDate ? (
          row.original.dueDate.toLocaleDateString()
        ) : (
          <span className="text-muted-foreground">Indefinido</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "startDate",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Data de início
        <ArrowUpDownIcon className="size-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div>
        {row.original.startDate ? (
          row.original.startDate.toLocaleDateString()
        ) : (
          <span className="text-muted-foreground">Indefinido</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "column",
    header: "Status",
    cell: ({ row }) => {
      const column = row.original.column;

      if (!column) {
        return (
          <span className="text-sm text-muted-foreground">Sem status</span>
        );
      }

      return (
        <span
          style={{
            backgroundColor: column.color ?? "",
            color: getContrastColor(column.color ?? "#000000"),
          }}
          className="rounded-sm px-2 py-0.5 truncate font-semibold"
        >
          {column.name}
        </span>
      );
    },
  },
  {
    accessorKey: "priority",
    header: "Prioridade",
    cell: ({ row }) => {
      const priority = row.original.priority;
      return (
        <span
          className={cn(
            "rounded-sm px-2 py-0.5 truncate font-semibold",
            priorityColors[priority],
          )}
        >
          {priority}
        </span>
      );
    },
  },
  {
    accessorKey: "isDone",
    header: "Concluído",
    cell: ({ row }) => {
      const isDone = row.original.isDone;
      return (
        <div className="flex items-center w-full">
          <CheckCircle2Icon
            className={cn("size-4", isDone && "text-green-500")}
          />
          <span className="ml-2">{isDone ? "Concluído" : "Incompleto"}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "participants",
    header: "Participantes",
    cell: ({ row }) => {
      const participants = row.original.participants;

      return (
        <div className="flex -space-x-2 w-full">
          {participants.slice(0, 6).map((participant) => (
            <Avatar className="size-6" key={participant.user.id}>
              <AvatarImage
                src={participant?.user?.image || ""}
                alt={participant.user.name}
              />
              <AvatarFallback>{participant.user.name[0]}</AvatarFallback>
            </Avatar>
          ))}
          {participants.length > 6 && (
            <Avatar className="size-6">
              <AvatarFallback>+{participants.length - 6}</AvatarFallback>
            </Avatar>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "subActions",
    header: "Subtarefas",
    cell: ({ row }) => {
      const subActions = row.original.subActions;
      const doneSubActions = subActions.filter(
        (subAction) => subAction.isDone,
      ).length;

      const isDone = doneSubActions === subActions.length;

      return (
        <div
          className={cn(
            "bg-accent rounded-sm px-1.5 w-fit",
            isDone && subActions.length > 0 && "bg-green-500",
          )}
        >
          {doneSubActions} / {subActions.length}
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Criado em",
    cell: ({ row }) => (
      <div className="w-full">
        {" "}
        {row.original.createdAt.toLocaleDateString()}{" "}
      </div>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <div className="flex items-center w-full">
        <CardActionsMenu
          actionId={row.original.id}
          workspaceId={row.original.workspaceId}
          isFavorited={row.original.isFavorited}
          isFavoritedByMe={row.original.isFavoritedByMe}
          isArchived={row.original.isArchived}
          className="size-7 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-sm"
        />
      </div>
    ),
  },
];
