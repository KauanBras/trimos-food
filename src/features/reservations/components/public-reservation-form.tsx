"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock3, LoaderCircle, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

type BusinessHour = {
  day_of_week: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
};

const restaurantClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Lisbon",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function lisbonClock(date: Date) {
  const parts = Object.fromEntries(
    restaurantClock
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(totalMinutes: number) {
  const normalized = totalMinutes % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function PublicReservationForm({
  restaurantId,
  slug,
  slotMinutes,
  advanceDays,
  businessHours,
  initialNow,
}: {
  restaurantId: string;
  slug: string;
  slotMinutes: number;
  advanceDays: number;
  businessHours: BusinessHour[];
  initialNow: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => lisbonClock(new Date(initialNow)), [initialNow]);
  const maximumDate = useMemo(
    () => addDays(today.date, advanceDays),
    [advanceDays, today.date],
  );
  const [date, setDate] = useState(today.date);
  const [time, setTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const availableTimes = useMemo(() => {
    if (!date) return [];
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    const periods = businessHours
      .filter(
        (item) =>
          item.day_of_week === dayOfWeek &&
          !item.is_closed &&
          item.opens_at &&
          item.closes_at,
      )
      .sort(
        (a, b) => minutesFromTime(a.opens_at!) - minutesFromTime(b.opens_at!),
      );
    const values = new Set<string>();

    for (const period of periods) {
      const opens = minutesFromTime(period.opens_at!);
      const rawCloses = minutesFromTime(period.closes_at!);
      const closes = rawCloses <= opens ? 24 * 60 : rawCloses;
      for (
        let minute = opens;
        minute < closes && values.size < 48;
        minute += slotMinutes
      ) {
        if (date === today.date && minute <= today.minutes) continue;
        values.add(formatTime(minute));
      }
    }

    return Array.from(values).sort();
  }, [businessHours, date, slotMinutes, today]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!time) {
      toast.error("Escolha um horário disponível.");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.rpc("create_public_reservation", {
      requested_restaurant_id: restaurantId,
      requested_customer_name: String(formData.get("customerName") ?? ""),
      requested_customer_phone: String(formData.get("customerPhone") ?? ""),
      requested_customer_email: String(formData.get("customerEmail") ?? ""),
      requested_date: date,
      requested_time: time,
      requested_party_size: Number(formData.get("partySize")),
      requested_special_requests: String(formData.get("specialRequests") ?? ""),
    });
    setSubmitting(false);

    if (error || !data?.[0]) {
      toast.error("Não foi possível concluir a reserva", {
        description: error?.message ?? "Tente novamente.",
      });
      return;
    }

    router.push(
      `/r/${slug}/reserva/${data[0].reservation_id}?token=${data[0].reservation_token}`,
    );
  }

  return (
    <Card className="border-zinc-200 bg-white shadow-xl shadow-zinc-200/60">
      <CardContent className="p-5 sm:p-7">
        <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customerName">Nome</Label>
            <Input
              id="customerName"
              name="customerName"
              required
              minLength={2}
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerPhone">Telefone</Label>
            <Input
              id="customerPhone"
              name="customerPhone"
              required
              minLength={6}
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerEmail">E-mail</Label>
            <Input
              id="customerEmail"
              name="customerEmail"
              type="email"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reservationDate">Data</Label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <Input
                id="reservationDate"
                type="date"
                min={today.date}
                max={maximumDate}
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setTime("");
                }}
                className="pl-9"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="partySize">Pessoas</Label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <Input
                id="partySize"
                name="partySize"
                type="number"
                min="1"
                max="50"
                defaultValue="2"
                className="pl-9"
                required
              />
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Horário</Label>
            {availableTimes.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {availableTimes.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTime(value)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${time === value ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 hover:border-zinc-400"}`}
                  >
                    <Clock3 className="mr-1 inline size-3.5" />
                    {value}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
                Não existem horários disponíveis nesta data.
              </div>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="specialRequests">Pedido especial</Label>
            <Textarea
              id="specialRequests"
              name="specialRequests"
              placeholder="Cadeira de bebé, alergias, aniversário..."
            />
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={submitting || !availableTimes.length}
            className="h-12 bg-zinc-950 hover:bg-zinc-800 sm:col-span-2"
          >
            {submitting ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : (
              <CalendarDays className="mr-2 size-4" />
            )}
            {submitting ? "A reservar..." : "Pedir reserva"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
