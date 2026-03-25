import { Separator } from "@/components/ui/separator";
import CreateForm from "./create-form";
import { StatsListWrap } from "./status-list-wrap";
import { FormList } from "./form-list";

export function FormPage() {
  return (
    <div className="w-full">
      <div className="w-full mx-auto  md:px-10 pt-1">
        {/* {FORM STATS} */}
        <section className="stats-section w-full">
          <div className="w-full flex items-center justify-between py-5">
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <CreateForm />
          </div>
          <StatsListWrap />
        </section>
        <div className="mt-10">
          <Separator />
        </div>
        {/* {ALL FORM} */}

        <section className="w-full pt-7 pb-10">
          <div
            className="w-full flex 
          items-center mb-4"
          >
            <h5
              className="text-xl
             font-semibold
             tracking-tight
             "
            >
              All Forms
            </h5>
          </div>
          <FormList />
          {/* <div className="flex items-center justify-center">
            No form created
          </div> */}
        </section>
      </div>
    </div>
  );
}
