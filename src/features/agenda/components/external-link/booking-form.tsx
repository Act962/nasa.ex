"use client";

import { getLocalTimeZone, parseDate } from "@internationalized/date";

import { Card, CardContent } from "@/components/ui/card";
import {
  useCreateAppointment,
  useQueryPublicAgenda,
} from "../../hooks/use-public-agenda";
import {
  CalendarXIcon,
  ChevronDownIcon,
  ClockIcon,
  GlobeIcon,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { RenderCalendar } from "./render-calendar";
import dayjs from "dayjs";
import { useQueryState } from "nuqs";
import { TimeTable } from "./time-table";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useLocale } from "react-aria";
import z from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { normalizePhone, phoneMask } from "@/utils/format-phone";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { countries } from "@/types/some";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "next/navigation";

interface BookingFormProps {
  orgSlug: string;
  agendaSlug: string;
}

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  code: z.string().optional(),
  phone: z.string().min(1, "Telefone é obrigatório"),
  email: z.email("Email inválido").optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function BookingForm({ orgSlug, agendaSlug }: BookingFormProps) {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      code: "55",
      email: "",
      notes: "",
    },
  });
  const createAppointment = useCreateAppointment();
  const router = useRouter();
  const { locale } = useLocale();
  const { agenda } = useQueryPublicAgenda({ orgSlug, agendaSlug });

  const [date] = useQueryState("date");
  const [time] = useQueryState("time");
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const selectedCode = form.watch("code");
  const countrySelected =
    countries.find((c) => c.code === selectedCode) || countries[0];

  const selectedDate = date
    ? parseDate(date).toDate(getLocalTimeZone())
    : new Date();

  const showForm = !!date && !!time;

  const onSubmit = (data: FormData) => {
    if (!time) return;

    const phone = normalizePhone(countrySelected.ddi + data.phone);

    createAppointment.mutate(
      {
        agendaSlug,
        orgSlug,
        date: dayjs(selectedDate).format("YYYY-MM-DD"),
        time,
        phone,
        email: data.email,
        name: data.name,
        notes: data.notes,
        timeZone,
      },
      {
        onSuccess: () => {
          router.replace(`/agenda/${orgSlug}/${agendaSlug}/success`);
        },
      },
    );
  };

  const isSubmitting = createAppointment.isPending;

  if (showForm) {
    return (
      <Card className="max-w-[850px] w-full">
        <CardContent className="p-5 md:grid md:grid-cols-[1fr_auto_1fr] gap-5">
          <div className="">
            {agenda?.organization.logo && (
              <div className="w-10 h-10 rounded-full overflow-hidden object-cover">
                <img
                  src={agenda?.organization.logo}
                  alt={agenda?.organization.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <p className="text-sm font-medium text-muted-foreground mt-1">
              {agenda?.organization.name}
            </p>
            <h1 className="text-xl font-semibold mt-2">{agenda?.name}</h1>
            <p className="text-sm font-medium text-muted-foreground">
              {agenda?.description}
            </p>

            <div className="mt-5 flex flex-col gap-y-3">
              <p className="flex items-center">
                <CalendarXIcon className="size-4 mr-2 text-primary" />
                <span className="text-sm font-medium text-muted-foreground capitalize">
                  {dayjs(selectedDate).locale(locale).format("D MMMM YYYY")}
                </span>
              </p>

              <p className="flex items-center">
                <ClockIcon className="size-4 mr-2 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">
                  {agenda?.slotDuration} minutos
                </span>
              </p>

              <p className="flex items-center">
                <GlobeIcon className="size-4 mr-2 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground capitalize">
                  {timeZone}
                </span>
              </p>
            </div>
          </div>

          <Separator orientation="vertical" className="w-px! h-full" />

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="mt-5 md:mt-0 flex flex-col gap-y-4"
          >
            <Field className="gap-y-2">
              <FieldLabel htmlFor="name" className="gap-1">
                Nome <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="name"
                placeholder="Seu nome"
                disabled={isSubmitting}
                {...form.register("name")}
              />
            </Field>
            <Field className="gap-y-2">
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                placeholder="johndoe@exemple.com"
                disabled={isSubmitting}
                {...form.register("email")}
              />
            </Field>
            <Field className="gap-y-2">
              <FieldLabel htmlFor="phone" className="gap-1">
                Telefone <span className="text-destructive">*</span>
              </FieldLabel>

              <Controller
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <InputGroup className="px-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          disabled={isSubmitting}
                          className={cn(
                            "text-xs flex items-center hover:bg-accent transition-all px-1 rounded-sm py-1 gap-x-1",
                            countrySelected && "bg-accent",
                          )}
                        >
                          <img
                            src={countrySelected.flag}
                            alt={countrySelected.country}
                            className="size-4 rounded-sm"
                          />
                          <span>{countrySelected.ddi}</span>
                          <ChevronDownIcon className="size-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="[--radius:0.95rem] max-h-30 overflow-y-auto"
                      >
                        <DropdownMenuGroup>
                          {countries.map((country) => (
                            <DropdownMenuItem
                              key={country.code}
                              onClick={() =>
                                form.setValue("code" as any, country.code)
                              }
                              className="cursor-pointer"
                            >
                              <img
                                src={country.flag}
                                alt={country.country}
                                className="size-5 rounded-sm"
                              />
                              <span>{country.ddi}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <InputGroupInput
                      placeholder="(00) 0000-0000"
                      className="pl-2"
                      disabled={isSubmitting}
                      {...field}
                      onChange={(e) => {
                        const phone = phoneMask(e.target.value);
                        field.onChange(phone);
                      }}
                    />
                  </InputGroup>
                )}
              />
              <FieldDescription>
                Digite seu telefone no formato (00) 0000-0000, sem o 9
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">Observações</FieldLabel>
              <Textarea
                id="notes"
                disabled={isSubmitting}
                placeholder="Observações"
                {...form.register("notes")}
              />
            </Field>

            <Button type="submit" className="mt-5" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              Confirmar
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-250 w-full mx-auto">
      <CardContent className="p-5 md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4">
        <div className="">
          {agenda?.organization.logo && (
            <div className="w-10 h-10 rounded-full overflow-hidden object-cover">
              <img
                src={agenda?.organization.logo}
                alt={agenda?.organization.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <p className="text-sm font-medium text-muted-foreground mt-1">
            {agenda?.organization.name}
          </p>
          <h1 className="text-xl font-semibold mt-2">{agenda?.name}</h1>
          <p className="text-sm font-medium text-muted-foreground">
            {agenda?.description}
          </p>

          <div className="mt-5 flex flex-col gap-y-3">
            <p className="flex items-center">
              <CalendarXIcon className="size-4 mr-2 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">
                {dayjs(selectedDate).format("D MMMM YYYY")}
              </span>
            </p>

            <p className="flex items-center">
              <ClockIcon className="size-4 mr-2 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">
                {agenda?.slotDuration} minutos
              </span>
            </p>

            <p className="flex items-center">
              <GlobeIcon className="size-4 mr-2 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground capitalize">
                {timeZone}
              </span>
            </p>
          </div>
        </div>

        <Separator orientation="vertical" className="w-px! h-full" />

        <RenderCalendar availabilities={agenda?.availabilities as any} />

        <Separator orientation="vertical" className="w-px! h-full" />

        <TimeTable
          selectedDate={selectedDate}
          orgSlug={orgSlug}
          agendaSlug={agendaSlug}
          slotDuration={agenda?.slotDuration as number}
        />
      </CardContent>
    </Card>
  );
}
