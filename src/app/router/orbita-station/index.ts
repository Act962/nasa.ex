import { getJoinToken } from "./get-join-token";
import { getStation } from "./get-station";
import { saveAvatar } from "./save-avatar";
import { updateStation } from "./update-station";

export const orbitaStationRouter = {
  getStation,
  getJoinToken,
  updateStation,
  avatar: {
    save: saveAvatar,
  },
};
