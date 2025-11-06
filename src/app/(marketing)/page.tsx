import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Heading } from "./_components/heading";

export default function Home() {
  return (
    <div className="h-full flex flex-col gap-y-4 items-center justify-center text-center">
      <Heading />
    </div>
  );
}
