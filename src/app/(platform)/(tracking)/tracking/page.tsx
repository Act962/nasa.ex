import { ModeToggle } from "@/components/mode-toggle";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
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
import { ModalCreateTracking } from "@/features/tracking/modal-create-tracking";
import { prefetchTrackings } from "@/features/tracking/server/prefetch";
import { HydrateClient } from "@/trpc/server";
import { ErrorBoundary } from "react-error-boundary";
import { Suspense } from "react";

import { Spinner } from "@/components/spinner";
import { TrackingList } from "@/features/tracking/components/trackings";

export default async function Page() {
  await requireAuth();

  prefetchTrackings();

  return (
    <HydrateClient>
      <ErrorBoundary fallback={<p>Something went wrong</p>}>
        <Suspense fallback={<Spinner />}>
          <TrackingList />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  );
}

// export default async function TrackingPage() {
//   const session = await requireAuth();

//   prefetchTrackings();

//   const trackings = await prisma.tracking.findMany({
//     where: {
//       participants: {
//         some: {
//           userId: session.user.id,
//         },
//       },
//     },
//   });

//   console.log(trackings);

//   return (
//     <div className="h-full px-4">
//       <Heading />

//       {trackings.length > 0 ? (
//         <p>Trackings</p>
//       ) : (
//         <div className="flex items-center justify-center mt-16">
//           <Empty>
//             <EmptyHeader>
//               <EmptyMedia variant="icon">
//                 <Folder />
//               </EmptyMedia>
//               <EmptyTitle>Nenhum tracking encontrado</EmptyTitle>
//               <EmptyDescription>
//                 Você não possui nenhum trackings criado ainda. Começe criando
//                 seu primeiro tracking
//               </EmptyDescription>
//             </EmptyHeader>
//             <EmptyContent>
//               <div className="flex gap-2">
//                 <ModalCreateTracking>
//                   <Button>Criar novo tracking</Button>
//                 </ModalCreateTracking>
//               </div>
//             </EmptyContent>
//           </Empty>
//         </div>
//       )}
//     </div>
//   );
// }
