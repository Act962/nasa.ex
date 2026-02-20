import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { client } from "@/lib/orpc";
import { useChat } from "@ai-sdk/react";
import { eventIteratorToStream } from "@orpc/client";
import { SparklesIcon } from "lucide-react";
import { useState } from "react";

interface ComposeAssistentProps {
  content: string;
}

export function ComposeResponse({ content }: ComposeAssistentProps) {
  const [open, setOpen] = useState(false);

  //   const {  } = useChat({
  //     id: "compose-response",
  //     transport: {
  //         async sendMessages(options) {
  //             return eventIteratorToStream(
  //                 await client.ia.compose.generate({
  //                     me
  //                 })
  //             )
  //         },
  //     }

  //   })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <SparklesIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-100 p-0" align="end">
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Compor resposta</h4>
          </div>

          <Input placeholder="Digite uma mensagem" />
          <Button className="ml-auto">Gerar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
