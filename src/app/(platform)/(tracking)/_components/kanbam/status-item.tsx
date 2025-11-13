"use client";

import { cn } from "@/lib/utils";
import { LeadForm } from "./lead-form";
import { StatusHeader } from "./status-header";
import { ScrollArea } from "@/components/ui/scroll-area";

type Lead = {
  id: string;
  name: string;
  email: string | null;
  order: number;
  phone: string | null;
  statusId: string;
};

interface StatusItemProps {
  data: {
    id: string;
    name: string;
    color: string | null;
    order: number;
    trackingId: string;
    leads: Lead[];
  };
  index: number;
}
export const StatusItem = ({ data, index }: StatusItemProps) => {
  return (
    <li className="shrink-0 w-[272px] h-full flex flex-col select-none">
      <div className="flex flex-col flex-1 min-h-0 rounded-md bg-muted/80 shadow-md pb-2">
        <StatusHeader data={data} />
        <ScrollArea className="flex-1 min-h-0">
          <ol
            className={cn(
              "mx-1 px-1 py-0.5 flex flex-col gap-y-2",
              data.leads.length > 0 ? "mt-2" : "mt-0"
            )}
          >
            {data.leads.map((lead, index) => (
              <LeadItem key={lead.id} data={lead} index={index} />
            ))}
          </ol>
        </ScrollArea>
        <LeadForm statusId={data.id} />
      </div>
    </li>
  );
};
// export const StatusItem = ({ data, index }: StatusItemProps) => {
//   return (
//     <li className="shrink-0 h-full w-[272] select-none">
//       <div className="w-full rounded-md bg-muted/80 shadow-md pb-2">
//         <StatusHeader data={data} />

//         <ScrollArea className="h-full">
//           <ol
//             className={cn(
//               "mx-1 px-1 py-0.5 flex flex-col gap-y-2 grow",
//               data.leads.length > 0 ? "mt-2" : "mt-0"
//             )}
//           >
//             {data.leads.map((lead, index) => (
//               <LeadItem key={lead.id} data={lead} index={index} />
//             ))}
//           </ol>
//         </ScrollArea>
//         <LeadForm statusId={data.id} />
//       </div>
//     </li>
//   );
// };

const LeadItem = ({ data, index }: { data: Lead; index: number }) => {
  return (
    <div className="truncate border-2 border-transparent hover:border-muted py-2 px-3 text-sm bg-muted rounded-md shadow-sm">
      {data.name}
    </div>
  );
};
