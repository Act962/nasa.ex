"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Award, GraduationCap, LayoutGrid, PenSquare, PlayCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NasaRoutePageTop, TopActionLink } from "../shared/nasa-route-page-top";
import { useNasaRouteStudentDock } from "../../hooks/use-nasa-route-dock";
import { NasaRouteCatalog } from "./nasa-route-catalog";
import { MyCoursesGrid } from "./my-courses-grid";

type HomeSection = "catalog" | "my-courses";

const MY_COURSES_PARAM_VALUE = "meus-cursos";

const SECTION_META: Record<HomeSection, { title: string; subtitle: string }> = {
  catalog: { title: "Cursos", subtitle: "Aprenda com criadores da ÓRBITA" },
  "my-courses": { title: "Meus cursos", subtitle: "Continue de onde parou" },
};

export function NasaRouteHome() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeSection: HomeSection =
    searchParams.get("secao") === MY_COURSES_PARAM_VALUE ? "my-courses" : "catalog";

  function selectSection(section: HomeSection) {
    const nextUrl = section === "my-courses" ? `${pathname}?secao=${MY_COURSES_PARAM_VALUE}` : pathname;
    router.replace(nextUrl, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useNasaRouteStudentDock({ activeSection, onSelectSection: selectSection });

  return (
    <div className="w-full flex-1 pb-[150px] lg:pb-16">
      <div className="mx-auto max-w-7xl px-4 pt-2 md:px-8 md:pt-6">
        <NasaRoutePageTop
          icon={<GraduationCap />}
          title="ÓRBITA Route"
          mobileTitle={SECTION_META[activeSection].title}
          subtitle="Cursos, treinamentos e eventos dos criadores da plataforma"
          mobileSubtitle={SECTION_META[activeSection].subtitle}
          actions={
            <>
              <TopActionLink href="/nasa-route/certificados" icon={<Award className="size-4" />} label="Meus certificados" />
              <TopActionLink href="/nasa-route/criador" icon={<PenSquare className="size-4" />} label="Sou criador" />
            </>
          }
        />

        {/* No celular as seções ficam no menu de baixo; as abas ficam só no computador. */}
        <Tabs
          value={activeSection}
          onValueChange={(section) => selectSection(section as HomeSection)}
          className="mt-5 max-md:sr-only"
        >
          <TabsList className="h-10">
            <TabsTrigger value="catalog" className="gap-1.5 text-xs">
              <LayoutGrid className="size-3.5" /> Catálogo
            </TabsTrigger>
            <TabsTrigger value="my-courses" className="gap-1.5 text-xs">
              <PlayCircle className="size-3.5" /> Meus cursos
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeSection === "catalog" ? (
        <NasaRouteCatalog />
      ) : (
        <div className="mx-auto mt-4 max-w-7xl px-4 md:mt-6 md:px-8">
          <MyCoursesGrid onExploreCatalog={() => selectSection("catalog")} />
        </div>
      )}
    </div>
  );
}
