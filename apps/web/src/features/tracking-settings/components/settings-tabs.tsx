"use client";

import type { ReactNode } from "react";
import { parseAsString, useQueryState } from "nuqs";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export type SettingsTab = {
  name: string;
  value: string;
  content: ReactNode;
};

interface Props {
  tabs: SettingsTab[];
  defaultTab: string;
}

export function SettingsTabs({ tabs, defaultTab }: Props) {
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault(defaultTab),
  );

  return (
    <Tabs
      value={tab}
      onValueChange={setTab}
      orientation="horizontal"
      className="flex-col sm:flex-row gap-6"
    >
      <TabsList className="bg-background h-full flex-row sm:flex-col rounded-none p-0 w-full sm:w-1/4 border-b sm:border-b-0 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:sticky sm:top-12 sm:self-start sm:max-h-[calc(100vh-3rem)] sm:overflow-y-auto">
        {tabs.map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="bg-background data-[state=active]:border-primary dark:data-[state=active]:border-primary h-full w-auto sm:w-full justify-start rounded-none border-0 border-b-2 sm:border-l-2 sm:border-b-0 border-transparent data-[state=active]:shadow-none sm:py-3 whitespace-nowrap px-4 first:pl-0 sm:first:pl-4"
          >
            {t.name}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="px-4 w-full py-4">
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {t.content}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
