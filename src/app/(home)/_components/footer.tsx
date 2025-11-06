import { Button } from "@/components/ui/button";
import { Logo } from "./logo";

export function Footer() {
  return (
    <div className=" fixed bottom-0 flex items-center w-full p-6 bg-background z-999999">
      <Logo />
      <div className="md:ml-auto w-full justify-between md:justify-end flex items-center gap-x-2 text-muted-foreground">
        <Button variant={"ghost"} size={"sm"}>
          Políticas de Privacidade
        </Button>
        <Button variant={"ghost"} size={"sm"}>
          Termos & Condições
        </Button>
      </div>
    </div>
  );
}
