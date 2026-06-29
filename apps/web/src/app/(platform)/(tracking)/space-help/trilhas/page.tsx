import { TracksGrid } from "@/features/space-help/components/tracks-grid";

export default function TrilhasIndexPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Rotas de Conhecimento
        </h1>
        <p className="mt-1 text-muted-foreground">
          Aprenda, complete e ganhe Stars, Space Points e selos exclusivos.
        </p>
      </header>
      <TracksGrid />
    </div>
  );
}
