export interface TimeSlot {
  time: string; // "09:00"
  available: boolean;
}

export interface DayAvailability {
  dayOfWeek: number; // 1=Monday, 6=Saturday
  enabled: boolean;
  startTime: string; // "08:00"
  endTime: string; // "18:00"
  slots: TimeSlot[];
}

export interface ScheduleEvent {
  id: string;
  title: string;
  description: string;
  duration: number; // minutes
  location: string;
  availability: DayAvailability[];
  createdAt: string;
}

export interface Booking {
  id: string;
  eventId: string;
  date: string; // ISO date
  time: string; // "09:00"
  name: string;
  email: string;
  phone: string;
  notes: string;
  createdAt: string;
}

export const DAY_NAMES: Record<number, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

export const TIME_OPTIONS: string[] = Array.from({ length: 33 }, (_, i) => {
  const hour = Math.floor(i / 2) + 6;
  const min = i % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${min}`;
});

export function generateSlotsFromRange(
  startTime: string,
  endTime: string,
  durationMinutes: number = 30,
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  for (let t = startTotal; t < endTotal; t += durationMinutes) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    slots.push({
      time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      available: true,
    });
  }
  return slots;
}

export const DEFAULT_AVAILABILITY: DayAvailability[] = [1, 2, 3, 4, 5, 6].map(
  (day) => ({
    dayOfWeek: day,
    enabled: true,
    startTime: "08:00",
    endTime: "18:00",
    slots: generateSlotsFromRange("08:00", "18:00"),
  }),
);
