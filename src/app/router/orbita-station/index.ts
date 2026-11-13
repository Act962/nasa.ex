import { listItems, moveItem, pickUpItem, placeItem } from "./decor-items";
import { getJoinToken } from "./get-join-token";
import { getRoomIndicators } from "./get-room-indicators";
import { getStation } from "./get-station";
import { saveAvatar } from "./save-avatar";
import { updateStation } from "./update-station";

export const orbitaStationRouter = {
  getStation,
  getJoinToken,
  getRoomIndicators,
  updateStation,
  items: {
    list: listItems,
    place: placeItem,
    move: moveItem,
    pickUp: pickUpItem,
  },
  avatar: {
    save: saveAvatar,
  },
};
