"use client";

import { StationProfileHeader } from "./station-profile-header";
import { StationOrgChart } from "./station-org-chart";
import { StationModulesGrid } from "./station-modules-grid";
import { StationExplorer } from "./station-explorer";
import { NasaFooterPublic } from "@/components/nasa-footer-public";
import type { PublicStation } from "../types";

interface Props {
  station: PublicStation;
}

export function StationPublicPage({ station }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <StationProfileHeader station={station} />

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        {/* Módulos públicos habilitados */}
        {station.publicModules.length > 0 && (
          <StationModulesGrid modules={station.publicModules} nick={station.nick} />
        )}

        {/* Organograma (apenas para orgs) */}
        {station.type === "ORG" && (
          <section>
            <StationOrgChart nick={station.nick} />
          </section>
        )}

        {/* STARs recebidos */}
        {station.receivedStars.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              ⭐ STARs Recebidos
            </h2>
            <div className="space-y-2">
              {station.receivedStars.map((star) => (
                <div
                  key={star.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10"
                >
                  <span className="text-yellow-400 font-bold">+{star.amount}</span>
                  {star.message && (
                    <p className="text-slate-300 text-sm flex-1">{star.message}</p>
                  )}
                  <span className="text-slate-600 text-xs">
                    {new Date(star.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Explorar outras stations */}
        <section className="border-t border-white/5 pt-10">
          <StationExplorer />
        </section>
      </div>

      <NasaFooterPublic />
    </div>
  );
}
