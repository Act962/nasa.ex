import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Download, DownloadCloud, Search } from "lucide-react";

export default function HeadingContacts() {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <h1>Leads</h1>
      </div>
      <InputGroup className="w-[250px]">
        <InputGroupInput placeholder="Buscar contato" />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
      </InputGroup>

      <div className="flex items-center gap-2">
        <Button variant={"outline"}>
          <DownloadCloud className="size-4" />
          Importar
        </Button>
        <Button>Adicionar novo lead</Button>
      </div>
    </div>
  );
}
