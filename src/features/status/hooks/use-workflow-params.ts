import { useQueryStates } from "nuqs";
import { statusParams } from "../params";

export const useStatusParams = () => {
  return useQueryStates(statusParams);
};
