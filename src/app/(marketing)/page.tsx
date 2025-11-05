import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="h-full flex flex-col gap-y-4 items-center justify-center">
      <h1 className="text-3xl font-medium">Bem-vindo ao Nasa.ex 2.0</h1>
      <Button asChild>
        <Link href="/sign-in" prefetch>
          Começar
        </Link>
      </Button>

      <ModeToggle />
    </div>
  );
}
