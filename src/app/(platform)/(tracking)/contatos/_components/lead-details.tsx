import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LeadInfo } from "./lead-info";

export function LeadDetails() {
  return (
    <div className="flex-1">
      <Sheet>
        <SheetTrigger asChild>
          <Button className="sm:hidden">Lead Info</Button>
        </SheetTrigger>
        <SheetContent side="left">
          <LeadInfo className=" w-full" />
        </SheetContent>
      </Sheet>

      <p>Lead Details</p>
    </div>
  );
}
