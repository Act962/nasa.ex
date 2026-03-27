import { Button } from "@/components/ui/button";
import { Frown } from "lucide-react";
import { useRouter } from "next/navigation";

export function NotAvaliable() {
  const router = useRouter();
  return (
    <div
      className="h-screen flex flex-col 
    items-center justify-center"
    >
      <div className="flex-1 flex flex-col justify-center items-center gap-4">
        <Frown size="80px" />
        <h2 className="text-xl font-semibold">
          Este formulário não está mais disponível
        </h2>
        <Button className="min-w-64" onClick={() => router.push("/")}>
          Voltar
        </Button>
      </div>

      <div
        className="shrink-0 
      min-h-14 text-center"
      >
        <p className="text-xs">Company by</p>
        <h5
          className="font-black 
         text-[20px] text-primary"
        >
          {" "}
          NasaEx
        </h5>
      </div>
    </div>
  );
}
