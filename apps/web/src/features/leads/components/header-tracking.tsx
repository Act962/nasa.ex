import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { StarsWidget } from "@/features/stars";
import { SpacePointWidget } from "@/features/space-point";

interface HeaderTrackingProps {
  title?: string;
}

export function HeaderTracking({ title }: HeaderTrackingProps) {
  return (
    <header
      className={[
        // layout
        " sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2",
        // sticky
        "sticky top-0 z-40",
        // visual
        "bg-background/90 backdrop-blur-md",
        "border-b border-border/50",
        // sidebar collapse transition
        "transition-[width,height] ease-linear",
        "group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
      ].join(" ")}
    >
      {/* ── Left: sidebar trigger + page title + spacehome button ── */}
      <div className="flex items-center gap-2 px-4 flex-1 min-w-0">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-1 data-[orientation=vertical]:h-4 opacity-50"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium text-sm">
                {title || "Tracking"}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Separator
          orientation="vertical"
          className="ml-1 data-[orientation=vertical]:h-4 opacity-50"
        />
        {/* <LinkSpacehomeButton /> */}
      </div>

      {/* ── Right: space point + stars widget ── */}
      <div className="flex items-center gap-2 px-4 shrink-0">
        <div data-tour="space-points">
          <SpacePointWidget />
        </div>
        <div data-tour="stars">
          <StarsWidget />
        </div>
      </div>
    </header>
  );
}
