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

function localIsoDate(date: Date) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 10);
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
}: {
  restaurantId: string;
  slug: string;
  slotMinutes: number;
  advanceDays: number;
  businessHours: BusinessHour[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => new Date(), []);
  const maximumDate = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() + advanceDays);
    return localIsoDate(date);
  }, [advanceDays, today]);
  const [date, setDate] = useState(localIsoDate(today));
  const [time, setTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const availableTimes = useMemo(() => {
    if (!date) return [];
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    const hours = businessHours.find((item) => item.day_of_week === dayOfWeek);
    if (!hours || hours.is_closed || !hours.opens_at || !hours.closes_at) return [];

    const opens = minutesFromTime(hours.opens_at);
    let closes = minutesFromTime(hours.closes_at);
    if (closes <= opens) closes += 24 * 60;
    const values: string[] = [];
    for (let minute = opens; minute < closes; minute += slotMinutes) {
      if (values.length >= 48) break;
      const value = formatTime(minute);
      if (date === localIsoDate(today) && minute <= today.getHours() * 60 + today.getMinutes()) continue;
      values.push(value);
    }
    return values;
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
      toast.error("Não foi possível concluir a reserva", { description: error?.message ?? "Tente novamente." });
      return;
    }

    router.push(`/r/${slug}/reserva/${data[0].reservation_id}?token=${data[0].reservation_token}`);
  }

  return (
    <Card className="border-zinc-200 bg-white shadow-xl shadow-zinc-200/60">
      <CardContent className="p-5 sm:p-7">
        <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="customerName">Nome</Label><Input id="customerName" name="customerName" required minLength={2} autoComplete="name" /></div>
          <div className="space-y-2"><Label htmlFor="customerPhone">Telefone</Label><Input id="customerPhone" name="customerPhone" required minLength={6} inputMode="tel" autoComplete="tel" /></div>
          <div className="space-y-2"><Label htmlFor="customerEmail">E-mail</Label><Input id="customerEmail" name="customerEmail" type="email" autoComplete="email" /></div>
          <div className="space-y-2">
            <Label htmlFor="reservationDate">Data</Label>
            <div className="relative"><CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" /><Input id="reservationDate" type="date" min={localIsoDate(today)} max={maximumDate} value={date} onChange={(event) => { setDate(event.target.value); setTime(""); }} className="pl-9" required /></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="partySize">Pessoas</Label>
            <div className="relative"><Users className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" /><Input id="partySize" name="partySize" type="number" min="1" max="50" defaultValue="2" className="pl-9" required /></div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Horário</Label>
            {availableTimes.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {availableTimes.map((value) => <button key={value} type="button" onClick={() => setTime(value)} className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${time === value ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 hover:border-zinc-400"}`}><Clock3 className="mr-1 inline size-3.5" />{value}</button>)}
              </div>
            ) : <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">Não existem horários disponíveis nesta data.</div>}
          </div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="specialRequests">Pedido especial</Label><Textarea id="specialRequests" name="specialRequests" placeholder="Cadeira de bebé, alergias, aniversário..." /></div>
          <Button type="submit" size="lg" disabled={submitting || !availableTimes.length} className="h-12 bg-zinc-950 hover:bg-zinc-800 sm:col-span-2">{submitting ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <CalendarDays className="mr-2 size-4" />}{submitting ? "A reservar..." : "Pedir reserva"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
