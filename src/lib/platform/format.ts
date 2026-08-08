export function formatMoneyFromCents(
  cents: number | null | undefined,
  currency = "EUR",
) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
  }).format((cents ?? 0) / 100);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Lisbon",
  }).format(new Date(value));
}
