import { Body } from "@/features/tracking-chat/components/body";
import { Footer } from "@/features/tracking-chat/components/footer";
import { Header } from "@/features/tracking-chat/components/header";

export default async function Page() {
  return (
    <div className="lg:ml-80 h-full">
      <div className="h-full flex flex-col relative">
        <Header conversation={{ name: "Conversation" }} />
        <Body />
        <Footer />
      </div>
    </div>
  );
}
