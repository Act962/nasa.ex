import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { CalendarIcon, NotepadTextIcon } from "lucide-react";
import Link from "next/link";

export default function Page() {
  return (
    <div className="h-full w-full">
      <HeaderTracking />
      <div className="flex flex-col items-center justify-center h-full w-full">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhuma agenda ainda</EmptyTitle>
            <EmptyDescription>
              Em breve você poderá criar agendas para capturar leads. Confira a
              última versão do app para usar este recurso.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="https://nasaex.com/tracking/agenda" target="_blank">
                Última versão
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    </div>
  );
}
