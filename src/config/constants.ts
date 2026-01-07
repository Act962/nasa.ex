import dayjs from "dayjs";

export const FILTERS = {
  INIT_DATE: dayjs().startOf("month").toDate(),
  END_DATE: dayjs().endOf("day").toDate(),
};
