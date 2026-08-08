type BusinessHour = {
  day_of_week: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
};

const weekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getRestaurantOperatingStatus(
  businessHours: BusinessHour[],
  timezone = "Europe/Lisbon",
  now = new Date(),
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  const dayOfWeek = weekdayMap[weekday ?? ""] ?? now.getDay();
  const schedule = businessHours.find(
    (businessHour) => businessHour.day_of_week === dayOfWeek,
  );

  if (!schedule || schedule.is_closed || !schedule.opens_at || !schedule.closes_at) {
    return { isOpen: false, label: "Fechado hoje" };
  }

  const currentMinutes = hour * 60 + minute;
  const opensAt = minutesFromTime(schedule.opens_at);
  const closesAt = minutesFromTime(schedule.closes_at);
  const isOpen =
    closesAt > opensAt
      ? currentMinutes >= opensAt && currentMinutes < closesAt
      : currentMinutes >= opensAt || currentMinutes < closesAt;

  return {
    isOpen,
    label: isOpen
      ? `Aberto até ${schedule.closes_at.slice(0, 5)}`
      : `Abre às ${schedule.opens_at.slice(0, 5)}`,
  };
}
