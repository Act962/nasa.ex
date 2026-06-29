"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { Plus, Link2, QrCode } from "lucide-react";
import { LinnkerPageCard } from "./linnker-page-card";
import { CreateLinnkerPageDialog } from "./create-linnker-page-dialog";
import type { LinnkerPage } from "../types";

export function LinnkerPage_() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery(
    orpc.linnker.listPages.queryOptions({}),
  );

  const pages = (data?.pages ?? []) as unknown as LinnkerPage[];

  return (
    <div className="w-full">
      <div className="w-full flex items-center justify-between py-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Linnker</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Crie páginas de bio com links personalizados e QR codes para capturar leads
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-2" />
          Nova página
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="size-16 rounded-full bg-muted flex items-center justify-center">
            <Link2 className="size-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Nenhuma página criada</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Crie sua primeira página Linnker e comece a compartilhar seus links
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-2" />
            Criar minha primeira página
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {pages.map((page) => (
            <LinnkerPageCard key={page.id} page={page} onRefetch={refetch} />
          ))}
        </div>
      )}

      <CreateLinnkerPageDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => { setCreateOpen(false); refetch(); }}
      />
    </div>
  );
}
