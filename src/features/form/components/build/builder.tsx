import { BuilderSidebar } from "./builder-sidebar";
import { BuilderCanvas } from "./builder-canvas";
import { BuilderBlockProperties } from "@/features/form/components/build/builder-block-properties";
import { FloatingShareButton } from "../common/floating-share-button";

export function Builder(props: {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}) {
  return (
    <>
      <BuilderSidebar
        isOpen={props.isSidebarOpen}
        onToggle={() => props.setIsSidebarOpen(!props.isSidebarOpen)}
      />
      <div className="flex-1">
        <div className="w-full h-full">
          <BuilderCanvas />
          <FloatingShareButton isSidebarOpen={props.isSidebarOpen} />
        </div>
      </div>
      <BuilderBlockProperties />
    </>
  );
}
