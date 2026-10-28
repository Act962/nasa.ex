import { getStation } from "./get-station";
import { saveAvatar } from "./save-avatar";
import { updateStation } from "./update-station";

export const orbitaStationRouter = {
  getStation,
  updateStation,
  avatar: {
    save: saveAvatar,
  },
};
