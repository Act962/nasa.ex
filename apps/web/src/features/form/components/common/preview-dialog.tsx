"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { defaultBackgroundColor } from "@/features/form/constants";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { FormBlocks } from "@/features/form/lib/form-blocks";

export function PreviewDialog() {
  const { blockLayouts } = useBuilderStore();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye />
          Preview
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex flex-col grow
       max-h-svh h-full p-0 gap-0 w-screen
        max-w-full"
      >
        <DialogHeader
          className="pt-4 px-4 
        pb-4 shadow-sm bg-background"
        >
          <DialogTitle>Preview Mode</DialogTitle>
        </DialogHeader>
        <div
          className="
                w-full h-full overflow-y-auto
                scrollbar transition-all duration-300
              "
          style={{
            backgroundColor: defaultBackgroundColor,
          }}
        >
          <div
            className="w-full h-full max-w-[650px] 
          mx-auto"
          >
            <div
              className="w-full relative
                    bg-transparent px-2flex flex-col
                    items-center justify-start pt-1
                    pb-14
                    "
            >
              <div
                className="w-full mb-3
             bg-accent/10 bg-[url(/images/form-bg.jpg)] bg-center bg-cover border shadow-sm h-[135px] max-w-[768px]
          rounded-md px-1"
              />

              {blockLayouts.length > 0 && (
                <div className="flex flex-col w-full gap-4">
                  {blockLayouts.map((block) => {
                    const FormBlockComponent =
                      FormBlocks[block.blockType].formComponent;
                    return (
                      <FormBlockComponent
                        key={block.id}
                        blockInstance={block}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
