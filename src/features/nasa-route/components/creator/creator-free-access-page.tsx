"use client";

import { Gift } from "lucide-react";
import { FreeAccessManager } from "./free-access-manager";
import { NasaRoutePageTop } from "../shared/nasa-route-page-top";
import { useNasaRouteCreatorDock } from "../../hooks/use-nasa-route-dock";

export function CreatorFreeAccessPage() {
  useNasaRouteCreatorDock("free-access");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-2 pb-[150px] md:py-8 lg:pb-10">
      <NasaRoutePageTop
        icon={<Gift />}
        title="Acesso livre"
        subtitle="Libere cursos para parceiros, testadores e bolsistas sem cobrar."
        mobileSubtitle="Libere cursos sem cobrar"
      />
      <div className="mt-5 md:mt-8">
        <FreeAccessManager isTitleHidden />
      </div>
    </div>
  );
}
