import { notFound } from "next/navigation";

import { PublicReservationStatus } from "@/features/reservations/components/public-reservation-status";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { DemoModeBanner } from "@/components/public/demo-mode-banner";

type ReservationPayload = {
  id: string;
  customerName: string;
  date: string;
  time: string;
  partySize: number;
  status: Database["public"]["Enums"]["reservation_status"];
  tableLabel: string | null;
  discountPercent: number | null;
  discountLabel: string | null;
};

export default async function ReservationStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; reservationId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ slug, reservationId }, query] = await Promise.all([params, searchParams]);
  if (!query.token) notFound();
  const supabase = await createClient();
  const [{ data, error }, { data: restaurant }] = await Promise.all([
    supabase.rpc("get_public_reservation_status", {
      requested_reservation_id: reservationId,
      requested_reservation_token: query.token,
    }),
    supabase.from("restaurants").select("is_demo").eq("slug", slug).eq("status", "active").maybeSingle(),
  ]);
  if (error || !data || !restaurant) notFound();
  const reservation = data as ReservationPayload;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 sm:py-20">
      {restaurant.is_demo ? <div className="-mx-4 -mt-10 mb-8 sm:-mt-20 sm:mb-12"><DemoModeBanner compact /></div> : null}
      <PublicReservationStatus reservationId={reservationId} token={query.token} slug={slug} initialStatus={reservation.status} customerName={reservation.customerName} date={reservation.date} time={reservation.time} partySize={reservation.partySize} tableLabel={reservation.tableLabel} discountPercent={reservation.discountPercent} discountLabel={reservation.discountLabel} />
    </main>
  );
}
