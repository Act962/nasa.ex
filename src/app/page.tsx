import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="h-full flex flex-col gap-y-4 items-center justify-center">
      <h1 className="text-3xl font-me">Bem-vindo ao Nasa.ex 2.0</h1>
      <Button>Começar</Button>

      <ModeToggle />
    </div>
  );
}
