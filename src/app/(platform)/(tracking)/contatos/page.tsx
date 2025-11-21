import { SidebarInset } from "@/components/ui/sidebar";
import HeadingContacts from "./_components/heading-contact";

export default async function ContatosPage() {
  return (
    <SidebarInset className="min-h-full pb-8">
      <HeadingContacts />

      <div>Contatos</div>
    </SidebarInset>
  );
}
