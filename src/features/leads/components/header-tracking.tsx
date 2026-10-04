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
import { AstroCommandButton } from "@/features/astro-commander/components/astro-command-button";
import { FullscreenControls } from "@/components/fullscreen-controls/fullscreen-controls";

interface HeaderTrackingProps {
  title?: string;
  /**
   * Liga o "Criar comando" do ASTRO com exemplos da área (spec 0029, RF-12).
   * Ausente = sem botão, para não mudar as telas que não pediram.
   */
  astroCommand?: { examples: readonly string[]; isHiddenOnMobile?: boolean };
  /** A página já mostra o próprio título: a barra de cima fica sem nome. */
  isTitleHidden?: boolean;
}

export function HeaderTracking({
  title,
  astroCommand,
  isTitleHidden = false,
}: HeaderTrackingProps) {
  return (
    <header
      className={[
        // layout
        " sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2",
        // sticky
        "sticky top-0 z-40",
        // visual
        "bg-background/90 backdrop-blur-md",
        // sidebar collapse transition
        "transition-[width,height] ease-linear",
        "group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
      ].join(" ")}
    >
      {/* ── Left: sidebar trigger + page title + spacehome button ── */}
      <div className="flex items-center gap-2 px-4 flex-1 min-w-0">
        <SidebarTrigger className="-ml-1" />
        {!isTitleHidden && (
          <>
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
          </>
        )}
        {/* <LinkSpacehomeButton /> */}
      </div>

      {/* ── Right: space point + stars widget ── */}
      <div className="flex items-center gap-2 px-4 shrink-0">
        {astroCommand && (
          <>
            <AstroCommandButton
              examples={astroCommand.examples}
              className="hidden sm:inline-flex"
            />
            {!astroCommand.isHiddenOnMobile && (
              <AstroCommandButton
                examples={astroCommand.examples}
                compact
                className="sm:hidden"
              />
            )}
          </>
        )}
        <div data-tour="space-points">
          <SpacePointWidget />
        </div>
        <div data-tour="stars">
          <StarsWidget />
        </div>
        <FullscreenControls />
      </div>
    </header>
  );
}
