import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { notFound } from "next/navigation";

import { PublicReservationForm } from "@/features/reservations/components/public-reservation-form";
import { createClient } from "@/lib/supabase/server";

export default async function PublicReservationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, slug, accepts_reservations, status, business_hours(day_of_week, opens_at, closes_at, is_closed)")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!restaurant) notFound();

  const { data: settings } = await supabase
    .rpc("get_public_reservation_settings", {
      requested_restaurant_id: restaurant.id,
    })
    .maybeSingle();

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-zinc-50 to-zinc-50 px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <Link href={`/r/${slug}`} className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-950"><ArrowLeft className="size-4" /> Voltar ao menu</Link>
        <div className="my-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-400 text-zinc-950"><CalendarDays className="size-6" /></div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Reservar no {restaurant.name}</h1>
          <p className="mt-2 text-zinc-500">Escolha o dia, horário e número de pessoas. A equipa receberá o pedido imediatamente.</p>
        </div>
        {!restaurant.accepts_reservations || !settings ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center shadow-sm"><p className="font-semibold">Reservas temporariamente indisponíveis</p><p className="mt-2 text-sm text-zinc-500">Contacte diretamente o restaurante.</p></div>
        ) : (
          <PublicReservationForm
            restaurantId={restaurant.id}
            slug={restaurant.slug}
            slotMinutes={settings.reservation_slot_minutes}
            advanceDays={settings.reservation_advance_days}
            businessHours={restaurant.business_hours ?? []}
            initialNow={new Date().toISOString()}
            promotion={{
              enabled: settings.reservation_discount_enabled,
              percent: settings.reservation_discount_percent,
              description: settings.reservation_discount_description,
              startsOn: settings.reservation_discount_starts_on,
              endsOn: settings.reservation_discount_ends_on,
              days: settings.reservation_discount_days,
              startTime: settings.reservation_discount_start_time,
              endTime: settings.reservation_discount_end_time,
            }}
          />
        )}
      </div>
    </main>
  );
}
