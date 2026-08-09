import { ReservationsClient } from "@/features/reservations/components/reservations-client";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export default async function ReservationsPage() {
  const { restaurantId } = await getCurrentRestaurant();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("id, customer_name, customer_phone, customer_email, reservation_date, reservation_time, party_size, table_label, status, source, special_requests, internal_notes, discount_percent, discount_label, created_at")
    .eq("restaurant_id", restaurantId)
    .order("reservation_date")
    .order("reservation_time");

  if (error) throw new Error(`Não foi possível carregar as reservas: ${error.message}`);

  return <ReservationsClient restaurantId={restaurantId} initialReservations={data ?? []} />;
}
