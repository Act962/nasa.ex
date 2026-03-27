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
import { FileTextIcon, Home } from "lucide-react";
import { FormBlockBox } from "@/features/form/components/common/form-block-box";
import { FormSettings } from "@/features/form/components/common/form-settings";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function BuilderSidebar({
  rest,
}: {
  rest?: React.ComponentProps<typeof Sidebar>;
}) {
  const { formData } = useBuilderStore();

  return (
    <div className="border-r left-12 overflow-y-auto pb-12" {...rest}>
      <div className=" py-4 px-0">
        <header
          className="border-b border-border
              w-full pt-1 pb-2 flex shrink-0 items-center gap-2
              "
        >
          <div className="flex items-center gap-2 px-4">
            <Home className="-ml-1 w-4 h-4" />
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
                    <h5 className="truncate flex w-[110px] text-sm">
                      {formData?.name || "Untitled"}
                    </h5>
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
      </div>
      <SidebarContent
        className="pt-2 
      px-5 "
      >
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
