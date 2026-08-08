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
  const currentMinutes = hour * 60 + minute;
  const periods = businessHours.filter(
    (businessHour) =>
      !businessHour.is_closed
      && businessHour.opens_at
      && businessHour.closes_at,
  );
  const activePeriod = periods.find((period) => {
    const opensAt = minutesFromTime(period.opens_at!);
    const closesAt = minutesFromTime(period.closes_at!);
    if (period.day_of_week === dayOfWeek) {
      return closesAt > opensAt
        ? currentMinutes >= opensAt && currentMinutes < closesAt
        : currentMinutes >= opensAt;
    }
    const previousDay = (dayOfWeek + 6) % 7;
    return period.day_of_week === previousDay
      && closesAt < opensAt
      && currentMinutes < closesAt;
  });

  if (activePeriod) {
    return {
      isOpen: true,
      label: `Aberto até ${activePeriod.closes_at!.slice(0, 5)}`,
    };
  }

  const nextPeriod = periods
    .filter((period) => period.day_of_week === dayOfWeek)
    .map((period) => ({
      period,
      opensAt: minutesFromTime(period.opens_at!),
    }))
    .filter(({ opensAt }) => opensAt > currentMinutes)
    .sort((a, b) => a.opensAt - b.opensAt)[0]?.period;

  return nextPeriod
    ? { isOpen: false, label: `Abre às ${nextPeriod.opens_at!.slice(0, 5)}` }
    : { isOpen: false, label: "Fechado hoje" };
}
