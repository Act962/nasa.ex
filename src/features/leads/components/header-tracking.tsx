import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { StarsWidget } from "@/features/stars";

interface HeaderTrackingProps {
  title?: string;
}

export function HeaderTracking({ title }: HeaderTrackingProps) {
  return (
    <header className={[
      // layout
      "flex h-14 shrink-0 items-center gap-2",
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
      {/* ── Left: sidebar trigger + page title ── */}
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
      </div>

      {/* ── Right: stars widget ── */}
      <div className="flex items-center px-4 shrink-0">
        <StarsWidget />
      </div>
    </header>
  );
}
