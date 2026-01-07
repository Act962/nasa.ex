import { FILTERS } from "@/config/constants";
import { parseAsIsoDateTime, parseAsString } from "nuqs/server";

export const statusParams = {
  date_init: parseAsIsoDateTime
    .withDefault(FILTERS.INIT_DATE)
    .withOptions({ clearOnDefault: true }),
  date_end: parseAsIsoDateTime
    .withDefault(FILTERS.END_DATE)
    .withOptions({ clearOnDefault: true }),
  participant: parseAsString
    .withDefault("")
    .withOptions({ clearOnDefault: true }),
};
