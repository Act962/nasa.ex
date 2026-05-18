import { listWorldEvents } from "./list-events";
import { getWorldEvent } from "./get-event";
import { createWorldEvent } from "./create-event";
import { updateWorldEvent } from "./update-event";
import { purchaseTicket } from "./purchase-ticket";
import { redeemTicket } from "./redeem-ticket";
import { listMyTickets } from "./my-tickets";
import { getEventOccupancy } from "./get-occupancy";

export const worldEventsRouter = {
  list: listWorldEvents,
  get: getWorldEvent,
  create: createWorldEvent,
  update: updateWorldEvent,
  purchaseTicket,
  redeemTicket,
  myTickets: listMyTickets,
  getOccupancy: getEventOccupancy,
};
