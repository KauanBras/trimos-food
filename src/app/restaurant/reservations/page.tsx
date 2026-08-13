import { ReservationsClient } from "@/features/reservations/components/reservations-client";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function ReservationsPage() {
  const { restaurantId, restaurant } = await getCurrentRestaurant();
  if (!restaurant.accepts_reservations) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="mx-auto max-w-2xl border-zinc-200 shadow-none">
          <CardContent className="p-8 text-center sm:p-12">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
              <CalendarOff className="size-7" />
            </div>
            <h1 className="mt-5 text-2xl font-semibold">Reservas desativadas</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
              Este restaurante está configurado para delivery e takeaway. Pode reativar as reservas quando quiser, sem perder o histórico anterior.
            </p>
            <Button render={<Link href="/restaurant/settings" />} nativeButton={false} className="mt-6">
              Abrir configurações
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
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
