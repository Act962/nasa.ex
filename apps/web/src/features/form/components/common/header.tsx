"use client";
import Link from "next/link";

import { useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const pathname = usePathname();
  const { formId } = useParams();

  const NAV_MENUS = [
    {
      name: "Dashboard",
      pathname: "/form",
      isDisabled: false,
    },
    {
      name: "Builder",
      pathname: `/form/builder/${formId}`,
      isDisabled: true,
    },
    {
      name: "Responds",
      pathname: `/form/responds/${formId}`,
      isDisabled: true,
    },
    {
      name: "Settings",
      pathname: "#",
      isDisabled: false,
    },
  ];

  return (
    <header
      className="
    sticky top-0 z-50 flex h-16 items-center gap-4 
    bg-background border-b px-4 md:px-6
    "
    >
      <nav
        className="gap-6 w-full h-full
           text-lg font-medium flex justify-between flex-row"
      >
        <div
          className="flex flex-1 items-center mr-5 pr-8 
         border-r"
        >
          <span className="sr-only">Formy</span>
        </div>
        <ul className="hidden md:flex flex-row">
          {NAV_MENUS.map((item, idx) => (
            <li key={idx} className="relative h-full">
              <Link
                href={item.pathname}
                className={cn(
                  `
                    text-muted-foreground text-[15.5px]
              font-normal z-10 flex items-center px-3
              justify-center h-full transition-colors 
              hover:text-foreground
                        `,
                  {
                    "opacity-80 pointer-events-none!": item.isDisabled,
                  },
                )}
              >
                {item.name}
              </Link>
              {pathname == item.pathname && (
                <div
                  className="absolute 
                          top-0 
                          left-0
                          right-0 
                          h-[52px]
                          bg-primary
                          transition-colors
                          ease-in-out
                          rounded-b-xl
                          -z-1"
                />
              )}
            </li>
          ))}
        </ul>

        <div
          className="flex 
        items-center gap-1
        justify-end w-full"
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </header>
  );
}
