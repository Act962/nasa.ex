"use client";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { MousePointerClickIcon } from "lucide-react";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import { SaveFormBtn } from "../common/save-form-btn";
import { PublishFormBtn } from "../common/publish-form-btn";

export function BuilderBlockProperties() {
  const { selectedBlockLayout } = useBuilderStore();

  const LayoutPropertyBlock =
    selectedBlockLayout &&
    FormBlocks[selectedBlockLayout.blockType]?.propertiesComponent;

  return (
    <div className="relative w-[320px]">
      <div
        className="fixed right w-[320px]
      bg-background border-l shadow-sm
      h-screen pb-36 mt-0 scrollbar overflow-auto"
      >
        <div
          className="flex flex-col w-full items-center
        h-auto min-h-full"
        >
          <div className="w-full flex flex-row justify-end items-center dark:bg-accent pb-2 pt-3 sticky border-b border top-0 gap-2 px-2">
            {/* <PreviewDialog /> */}
            <SaveFormBtn />
            <PublishFormBtn />
          </div>

          {/* {Layout Property} */}
          {!selectedBlockLayout ? (
            <div
              className=" gap-1
             text-center text-[15px] w-full flex flex-col
             items-center
             justify-center flex-1 h-auto"
            >
              <MousePointerClickIcon />
              <p>clique no layout para modificar</p>
            </div>
          ) : (
            <div className="w-full pt-1">
              <div className="px-2 pt-3 pb-3 border-b">
                <h5
                  className="text-left
                 font-medium text-sm"
                >
                  Propriedades do grupo
                </h5>

                {LayoutPropertyBlock && (
                  <LayoutPropertyBlock blockInstance={selectedBlockLayout} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
