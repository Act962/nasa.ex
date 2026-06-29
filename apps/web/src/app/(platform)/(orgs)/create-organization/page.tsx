import { GalleryVerticalEnd } from "lucide-react";
import { FormCreateOrg } from "../_components/form-create-org";

export default async function OrganizationPage() {
  return (
    <div className="h-full flex flex-col items-center justify-center px-4">
      <div className="fixed top-0 left-0 flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="/tracking" className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Nasa.ex
          </a>
        </div>
      </div>
      <FormCreateOrg />
    </div>
  );
}
