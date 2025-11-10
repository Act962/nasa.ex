import Heading from "../_components/heading";
import { requireAuth } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalCreateTracking } from "@/features/tracking/components/modal-create-tracking";

export default async function TrackingPage() {
  const session = await requireAuth();

  const trackings = await prisma.tracking.findMany({
    where: {
      participants: {
        some: {
          userId: session.user.id,
        },
      },
    },
  });

  console.log(trackings);

  return (
    <div className="h-full px-4">
      <Heading />

      {trackings.length > 0 ? (
        <p>Trackings</p>
      ) : (
        <div className="flex items-center justify-center mt-16">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Folder />
              </EmptyMedia>
              <EmptyTitle>Nenhum tracking encontrado</EmptyTitle>
              <EmptyDescription>
                Você não possui nenhum trackings criado ainda. Começe criando
                seu primeiro tracking
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex gap-2">
                <ModalCreateTracking>
                  <Button>Criar novo tracking</Button>
                </ModalCreateTracking>
              </div>
            </EmptyContent>
          </Empty>
        </div>
      )}
    </div>
  );
}
