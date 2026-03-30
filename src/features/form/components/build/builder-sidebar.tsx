"use client";
import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { FileTextIcon, HomeIcon } from "lucide-react";
import { FormBlockBox } from "@/features/form/components/common/form-block-box";
import { FormSettings } from "@/features/form/components/common/form-settings";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Edit2, X } from "lucide-react";
import { useMutationUpdateForm } from "../../hooks/use-form";

export function BuilderSidebar({
  rest,
}: {
  rest?: React.ComponentProps<typeof Sidebar>;
}) {
  const { formData, setFormData } = useBuilderStore();
  const [isEditing, setIsEditing] = useState(false);
  const [localName, setLocalName] = useState(formData?.name || "");
  const mutate = useMutationUpdateForm();

  useEffect(() => {
    if (formData?.name) {
      setLocalName(formData.name);
    }
  }, [formData?.name]);

  const handleSave = () => {
    if (!formData) return;
    if (localName.trim() === "") {
      setLocalName(formData.name);
      setIsEditing(false);
      return;
    }

    setFormData({
      ...formData,
      name: localName,
    });
    mutate.mutate({
      id: formData.id,
      name: localName,
      jsonBlock: formData.jsonBlock,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalName(formData?.name || "");
    setIsEditing(false);
  };

  return (
    <div className="border-r left-12 h-full overflow-y-auto pb-12" {...rest}>
      <div className="py-4 px-0">
        <header className="border-b border-border w-full pt-1 pb-2 flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <HomeIcon className="-ml-1 w-4 h-4" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/form">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="flex items-center gap-1">
                    <FileTextIcon className="w-4 h-4 mb-[3px]" />
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={localName}
                          onChange={(e) => setLocalName(e.target.value)}
                          className="h-6 w-[130px] px-2 text-sm "
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSave();
                            if (e.key === "Escape") handleCancel();
                          }}
                          onBlur={handleSave}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div
                        className="group flex items-center gap-1 cursor-pointer px-1 rounded-sm transition-colors"
                        onClick={() => setIsEditing(true)}
                      >
                        <h5 className="truncate max-w-[110px] text-sm font-medium">
                          {formData?.name || "Untitled"}
                        </h5>
                        <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                      </div>
                    )}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
      </div>
      <SidebarContent className="pt-2 px-5">
        <Tabs defaultValue="blocks" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="blocks">Blocos</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="blocks" className="mt-0">
            <FormBlockBox />
          </TabsContent>
          <TabsContent value="settings" className="mt-0">
            <FormSettings />
          </TabsContent>
        </Tabs>
      </SidebarContent>
    </div>
  );
}
