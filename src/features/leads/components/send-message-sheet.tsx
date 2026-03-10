import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface SendMessageSheetProps {
  children: React.ReactNode;
}

export function SendMessageSheet({ children }: SendMessageSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Enviar mensagem</SheetTitle>
          <SheetDescription>Envie mensagem para o lead</SheetDescription>
        </SheetHeader>
        <div></div>
      </SheetContent>
    </Sheet>
  );
}
