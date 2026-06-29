import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LayoutPanelLeftIcon } from "lucide-react";
import { ActionSidebar } from "./sidebar";
import { Action } from "../../types";

interface ButtonSidebarSheetProps {
  action?: Action;
  isLoading: boolean;
  columns: any[];
  members: any[];
  onUpdateAction: (data: any) => void;
  onUpdateFields?: (data: any) => void;
  onToggleParticipant: (userId: string) => void;
  isUpdating: boolean;
  isUpdatingFields?: boolean;
  isAddingParticipant: boolean;
  isRemovingParticipant: boolean;
}

export function ButtonSidebarSheet(props: ButtonSidebarSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
        >
          <LayoutPanelLeftIcon className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="p-0 border-l w-80">
        <SheetHeader className="p-4 border-b sr-only">
          <SheetTitle>Informações da Ação</SheetTitle>
        </SheetHeader>
        <div className="h-full overflow-y-auto">
           <ActionSidebar {...props} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
