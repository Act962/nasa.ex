import { searchLookup } from "./lookup";
import { listFormRecords } from "./records";

export const formRecordsRouter = {
  lookup: { search: searchLookup },
  records: { list: listFormRecords },
};
