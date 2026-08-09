import { RestaurantSettingsForm } from "@/features/restaurants/components/restaurant-settings-form";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { getConnectedAccountState } from "@/lib/stripe/server";
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
      .select("primary_color, secondary_color, delivery_radius_km, delivery_fee_per_km, delivery_origin_latitude, delivery_origin_longitude, minimum_order_amount, default_delivery_fee, free_delivery_from, default_preparation_minutes, order_sound_enabled, auto_accept_orders, reservation_slot_minutes, reservation_capacity, reservation_advance_days, reservation_duration_minutes, auto_confirm_reservations, reservation_discount_enabled, reservation_discount_percent, reservation_discount_description, reservation_discount_starts_on, reservation_discount_ends_on, reservation_discount_days, reservation_discount_start_time, reservation_discount_end_time, accepts_cash, accepts_terminal, accepts_mb_way, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted, stripe_mb_way_enabled, driver_pool_mode, driver_fee_base, driver_fee_per_km")
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

  let currentSettings = settingsResult.data;
  if (currentSettings.stripe_account_id) {
    try {
      const accountState = await getConnectedAccountState(
        currentSettings.stripe_account_id,
      );
      const stripeUpdates = {
        stripe_charges_enabled: accountState.chargesEnabled,
        stripe_payouts_enabled: accountState.payoutsEnabled,
        stripe_details_submitted: accountState.detailsSubmitted,
        stripe_mb_way_enabled: accountState.mbWayEnabled,
      };
      const stripeStateChanged = Object.entries(stripeUpdates).some(
        ([key, value]) =>
          currentSettings[key as keyof typeof stripeUpdates] !== value,
      );

      if (stripeStateChanged) {
        const { error: stripeSyncError } = await supabase
          .from("restaurant_settings")
          .update(stripeUpdates)
          .eq("restaurant_id", restaurantId);
        if (!stripeSyncError) {
          currentSettings = { ...currentSettings, ...stripeUpdates };
        }
      } else {
        currentSettings = { ...currentSettings, ...stripeUpdates };
      }
    } catch {
      // A página continua disponível se a Stripe estiver temporariamente indisponível.
    }
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
        settings={currentSettings}
        businessHours={hoursResult.data ?? []}
      />
    </div>
  );
}
