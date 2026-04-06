import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { SupportForm } from "./_components/form";

export default function SupportPage() {
  return (
    <SidebarInset className="min-h-full pb-12 bg-zinc-950">
      <HeaderTracking title="Suporte" />
      <div className="flex flex-col items-center justify-center px-4 py-10 w-full max-w-4xl mx-auto">
        <div className="w-full text-center mb-10 space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight bg-linear-to-br from-white to-white/40 bg-clip-text text-transparent">
            Central de Feedback NASA
          </h1>
          <p className="text-muted-foreground text-lg">
            Sua opinião é o combustível que nos leva mais longe.
          </p>
        </div>
        <div className="w-full">
          <SupportForm />
        </div>
      </div>
    </SidebarInset>
  );
}

