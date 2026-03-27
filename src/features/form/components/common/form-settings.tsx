import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBuilderStore } from "../../context/builder-form-provider";
import {
  useQueryStatus,
  useQueryTrackings,
} from "@/features/trackings/hooks/use-trackings";

export function FormSettings() {
  const { formData, setFormData } = useBuilderStore();
  const { trackings } = useQueryTrackings();
  const { status } = useQueryStatus({
    trackingId: formData?.settings.trackingId || "",
  });

  const trackingName = trackings?.find(
    (tracking) => tracking.id === formData?.settings.trackingId,
  )?.name;

  const statusName = status?.find(
    (status) => status.id === formData?.settings.statusId,
  )?.name;

  return (
    <div className="">
      <h2 className="text-lg font-medium mb-5">Configurações</h2>
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel>Tracking para direcionar</FieldLabel>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">{trackingName || "Selecionar"}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40" align="start">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Trackings</DropdownMenuLabel>
                {trackings?.map((tracking) => (
                  <DropdownMenuItem
                    onClick={() => {
                      if (!formData) return;
                      setFormData({
                        ...formData,
                        settings: {
                          ...formData.settings,
                          trackingId: tracking.id,
                        },
                      });
                    }}
                    key={tracking.id}
                  >
                    {tracking.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </Field>

        <Field>
          <FieldLabel>Status para direcionar</FieldLabel>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={!formData?.settings.trackingId}
              asChild
            >
              <Button variant="outline">{statusName || "Selecionar"}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40" align="start">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                {status?.map((status) => (
                  <DropdownMenuItem
                    onClick={() => {
                      if (!formData) return;
                      setFormData({
                        ...formData,
                        settings: {
                          ...formData.settings,
                          statusId: status.id,
                        },
                      });
                    }}
                    key={status.id}
                  >
                    {status.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </Field>
      </div>
    </div>
  );
}
