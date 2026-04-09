import { createSupportTicket } from "./create";
import { listSupportTickets } from "./list";
import { updateSupportTicketStatus } from "./update";

export const supportRouter = {
  createSupportTicket,
  listSupportTickets,
  updateSupportTicketStatus,
};
