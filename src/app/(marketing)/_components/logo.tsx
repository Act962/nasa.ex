import { cn } from "@/lib/utils";
import Image from "next/image";

export function Logo() {
  return (
    <div className="hidden md:flex items-center gap-x-2">
      <Image
        src={"/logo-dark.png"}
        height={40}
        width={40}
        alt="Logo"
        className="hidden dark:block"
      />
      <Image
        src={"/logo.png"}
        height={40}
        width={40}
        alt="Logo"
        className=" dark:hidden"
      />
      <p className={cn("font-semibold")}>Nasa.ex</p>
    </div>
  );
}
