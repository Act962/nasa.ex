"use client";

import Image from "next/image";
import { WhatsappIcon } from "@/components/whatsapp";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSendingNumbers } from "../hooks/use-sending-numbers";
import { CreateBroadcastDialog } from "./create-broadcast-dialog";
import { CONNECT_NUMBER_EVENT } from "./self-service/official-number-overview";

const HERO_CTA_CLASS =
  "h-11 w-full rounded-full bg-brand-whatsapp! font-bold text-brand-whatsapp-deep! hover:bg-brand-whatsapp/90! sm:w-auto sm:px-6";

/** Topo do app Campanhas com a identidade do WhatsApp/Meta. O saldo fica na barra de cima (CampanhasTopBar). */

export function CampanhasHero() {
  const { data: sendingNumbers, isLoading } = useSendingNumbers();
  const hasConnectedNumber = Boolean(sendingNumbers?.length);

  return (
    <section className="-mx-4 -mt-6 rounded-b-[28px] bg-brand-whatsapp-deep px-4 pt-2 pb-4 text-white sm:mx-0 sm:mt-0 sm:rounded-[28px] sm:p-6">
      <div className="flex items-center gap-2">
        <WhatsappIcon className="size-6 text-brand-whatsapp" />
        <span className="text-[15px] font-bold tracking-tight">WhatsApp Business</span>
        <Image
          src="/campanhas/meta-tech-provider.png"
          alt="Meta Tech Provider"
          width={130}
          height={72}
          className="ml-auto h-9 w-auto sm:h-11"
          priority
        />
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:mt-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-brand-whatsapp sm:text-3xl">Campanhas</h1>
          <p className="text-xs text-white/70 sm:text-sm">API oficial do WhatsApp · envio direto pela Meta</p>
        </div>
        {isLoading ? null : hasConnectedNumber ? (
          <CreateBroadcastDialog triggerClassName={HERO_CTA_CLASS} />
        ) : (
          <Button className={HERO_CTA_CLASS} onClick={() => window.dispatchEvent(new Event(CONNECT_NUMBER_EVENT))}>
            <Smartphone className="size-4" /> Conectar número
          </Button>
        )}
      </div>

    </section>
  );
}

