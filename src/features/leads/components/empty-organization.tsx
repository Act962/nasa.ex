import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ArrowUpRightIcon, Building } from "lucide-react";
import Link from "next/link";

export function EmptyOrganization() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Building />
        </EmptyMedia>
        <EmptyTitle>Nenhuma empresa selecionanda</EmptyTitle>
        <EmptyDescription>
          Selecione uma empresa ou crie uma nova
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/create-organization">Cria empresa</Link>
          </Button>
        </div>
      </EmptyContent>
      <Button
        variant="link"
        asChild
        className="text-muted-foreground"
        size="sm"
      >
        <a href="#">
          Ler mais <ArrowUpRightIcon />
        </a>
      </Button>
    </Empty>
  );
}
