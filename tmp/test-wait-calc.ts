import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Sao_Paulo";

function calculateTargetDate(
  type: string,
  value: number,
  hours: number,
  minutes: number,
) {
  const now = dayjs().tz(TIMEZONE);
  let targetDate = now;

  if (type === "DAYS") {
    targetDate = targetDate.add(value, "day");
  } else if (type === "WEEKS") {
    targetDate = targetDate.add(value, "week");
  } else if (type === "MONTHS") {
    targetDate = targetDate.add(value, "month");
  }

  targetDate = targetDate
    .set("hour", hours)
    .set("minute", minutes)
    .set("second", 0)
    .set("millisecond", 0);

  return {
    now: now.format(),
    target: targetDate.format(),
    iso: targetDate.toISOString(),
  };
}

console.log("Test 1: 1 day later at 10:00");
console.log(calculateTargetDate("DAYS", 1, 10, 0));

console.log("\nTest 2: 1 week later at 15:30");
console.log(calculateTargetDate("WEEKS", 1, 15, 30));

console.log("\nTest 3: 1 month later at 09:00");
console.log(calculateTargetDate("MONTHS", 1, 9, 0));
