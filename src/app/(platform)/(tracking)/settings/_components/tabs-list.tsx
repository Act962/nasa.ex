"use client";

import { SettingsIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabsLink = [
  {
    label: "Geral",
    href: "",
    icon: SettingsIcon,
  },
  {
    label: "Membros",
    href: "/members",
    icon: UsersIcon,
  },
];

export function TabsList() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    const fullPath = href ? `/settings${href}` : "/settings";
    return pathname === fullPath;
  };

  return (
    <div className="border-b pb-2 pl-4">
      <div className="w-full max-w-7xl mx-auto flex items-center gap-4">
        {tabsLink.map((tab) => (
          <Link
            key={tab.href}
            href={`/settings${tab.href}`}
            className={`flex items-center gap-2 text-sm font-medium whitespace-nowrap cursor-pointer hover:bg-muted px-2 py-1 rounded-md transition-colors ${
              isActive(tab.href) ? "bg-muted" : ""
            }`}
          >
            <tab.icon className="size-4" />
            <span className="text-sm font-medium text-foreground">
              {tab.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
