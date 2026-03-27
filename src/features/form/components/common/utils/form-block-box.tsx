"use client";
import { BlockBtnElement } from "./block-btn-element";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { FormBlocks } from "@/features/form/lib/form-blocks";
import React, { useState } from "react";
import { AiAssistanceBtn } from "./ai-assistance-btn";

export function FormBlockBox() {
  const { formData } = useBuilderStore();
  const isPublished = formData?.published;

  const [search, setSearch] = useState<string>("");

  const filteredBlocks = Object.values(FormBlocks).filter((block) =>
    block.blockBtnElement.label?.toLowerCase().includes(search.toLowerCase()),
  );

  const layoutBlocks = filteredBlocks.filter(
    (block) => block.blockCategory === "Layout",
  );

  const fieldBlocks = filteredBlocks.filter(
    (block) => block.blockCategory === "Field",
  );

  return (
    <div className="w-full">
      <div className="flex gap-2 py-4 text-sm">
        <Input
          placeholder="Pesquisar Blocos"
          className=" placeholder:text-gray-400 shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <AiAssistanceBtn />
      </div>
      <div
        className="flex flex-col 
      space-y-3
      w-full"
      >
        {layoutBlocks?.length > 0 && (
          <div className="mb-2">
            <h5
              className="text-[13px]
            font-medium"
            >
              Layouts
            </h5>

            <div className="pt-1 grid grid-cols-3 gap-3">
              {layoutBlocks?.map((block) => (
                <BlockBtnElement
                  key={block.blockType}
                  formBlock={block}
                  disabled={isPublished}
                />
              ))}
            </div>
          </div>
        )}

        <Separator />
        <div>
          <h5
            className="text-[13px]
            font-medium"
          >
            Fields
          </h5>

          <div className="pt-1 grid grid-cols-3 gap-3">
            {fieldBlocks?.map((block) => (
              <BlockBtnElement
                key={block.blockType}
                formBlock={block}
                disabled={isPublished}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
