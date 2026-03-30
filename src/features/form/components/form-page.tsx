import { Separator } from "@/components/ui/separator";
import { CreateForm } from "./create-form";
import { FormList } from "./form-list";
import StatsCards from "./stats-card";

export function FormPage() {
  return (
    <div className="w-full">
      <div className="w-full ">
        {/* {FORM STATS} */}
        <section className="stats-section w-full">
          <div className="w-full flex items-center justify-between py-5">
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <CreateForm />
          </div>
          <StatsCards />
        </section>
        <div className="mt-10">
          <Separator />
        </div>
        <section className="w-full pt-7 pb-10">
          <div className="w-full flex items-center mb-4">
            <h5 className="text-xl font-semibold tracking-tight">
              Todos os forms
            </h5>
          </div>
          <FormList />
        </section>
      </div>
    </div>
  );
}
