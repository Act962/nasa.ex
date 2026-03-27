import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { BuilderSidebar } from "./builder-sidebar";
import { BuilderCanvas } from "./builder-canvas";
import { BuilderBlockProperties } from "@/features/form/components/builder-block-properties";
import { FloatingShareButton } from "./common/floating-share-button";

export function Builder(props: { isSidebarOpen: boolean }) {
  return (
    <>
      <BuilderSidebar />
      <div className="p-0 flex-1">
        <div className="w-full h-full bg-accent">
          <SidebarTrigger className="absolute top-0 z-50 " />
          <BuilderCanvas />
          <FloatingShareButton isSidebarOpen={props.isSidebarOpen} />
        </div>
      </div>
      <BuilderBlockProperties />
    </>
  );
}
