export class PaymentReminderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentReminderError";
  }
}
