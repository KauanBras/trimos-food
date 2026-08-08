import { RestaurantSettingsForm } from "@/features/restaurants/components/restaurant-settings-form";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export default async function RestaurantSettingsPage() {
  const { restaurantId } = await getCurrentRestaurant();
  const supabase = await createClient();

  const [restaurantResult, settingsResult, hoursResult] = await Promise.all([
    supabase
      .from("restaurants")
      .select("name, slug, description, logo_url, cover_url, phone, email, tax_number, address_line, city, postal_code, accepts_delivery, accepts_pickup, accepts_dine_in, accepts_reservations")
      .eq("id", restaurantId)
      .single(),
    supabase
      .from("restaurant_settings")
      .select("primary_color, secondary_color, delivery_radius_km, delivery_fee_per_km, delivery_origin_latitude, delivery_origin_longitude, minimum_order_amount, default_delivery_fee, free_delivery_from, default_preparation_minutes, order_sound_enabled, auto_accept_orders, reservation_slot_minutes, reservation_capacity, reservation_advance_days, reservation_duration_minutes, auto_confirm_reservations")
      .eq("restaurant_id", restaurantId)
      .single(),
    supabase
      .from("business_hours")
      .select("day_of_week, opens_at, closes_at, is_closed, sort_order")
      .eq("restaurant_id", restaurantId)
      .order("day_of_week")
      .order("sort_order"),
  ]);

  if (restaurantResult.error || !restaurantResult.data) {
    throw new Error(restaurantResult.error?.message ?? "Restaurante não encontrado.");
  }
  if (settingsResult.error || !settingsResult.data) {
    throw new Error(settingsResult.error?.message ?? "Configurações não encontradas.");
  }
  if (hoursResult.error) {
    throw new Error(hoursResult.error.message);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-sm font-medium text-amber-600">Personalização e operação</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Controle a imagem pública, serviços, reservas, entregas e horários.
        </p>
      </div>

      <RestaurantSettingsForm
        restaurant={restaurantResult.data}
        settings={settingsResult.data}
        businessHours={hoursResult.data ?? []}
      />
    </div>
  );
}
