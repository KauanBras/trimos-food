import { RestaurantDriversClient } from "@/features/drivers/components/restaurant-drivers-client";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export default async function RestaurantDriversPage() {
  const { restaurantId, restaurant } = await getCurrentRestaurant();
  const supabase = await createClient();
  const [driversResult, invitesResult, earningsResult] = await Promise.all([
    supabase.from("restaurant_drivers").select("is_active, drivers(id, status, phone, vehicle_type, vehicle_plate, location_updated_at, is_network_enabled, payout_method, payout_phone, payout_iban, profiles(full_name, avatar_url, phone), deliveries!deliveries_driver_id_fkey(id, status, delivered_at))").eq("restaurant_id", restaurantId).order("created_at"),
    supabase.from("driver_invites").select("id, email, token, expires_at, accepted_at").eq("restaurant_id", restaurantId).order("created_at", { ascending: false }),
    supabase.from("driver_earnings").select("id, driver_fee, cash_collected, net_balance, status, created_at, settled_at, settlement_reference, drivers(id, payout_method, payout_phone, payout_iban, profiles(full_name)), orders(customer_name)").eq("restaurant_id", restaurantId).order("created_at", { ascending: false }),
  ]);
  if (driversResult.error) throw new Error(`Não foi possível carregar os estafetas: ${driversResult.error.message}`);
  if (invitesResult.error) throw new Error(`Não foi possível carregar os convites: ${invitesResult.error.message}`);
  if (earningsResult.error) throw new Error(`Não foi possível carregar os acertos: ${earningsResult.error.message}`);
  const drivers = (driversResult.data ?? []).flatMap((membership) => membership.drivers ? [{ ...membership.drivers, is_active: membership.is_active }] : []);
  return <RestaurantDriversClient initialDrivers={drivers} initialInvites={invitesResult.data ?? []} initialEarnings={earningsResult.data ?? []} currencyCode={restaurant.currency_code} initialNow={new Date().toISOString()} />;
}
