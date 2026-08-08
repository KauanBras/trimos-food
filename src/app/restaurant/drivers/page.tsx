import { RestaurantDriversClient } from "@/features/drivers/components/restaurant-drivers-client";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export default async function RestaurantDriversPage() {
  const { restaurantId } = await getCurrentRestaurant();
  const supabase = await createClient();
  const [driversResult, invitesResult] = await Promise.all([
    supabase.from("drivers").select("id, status, phone, vehicle_type, vehicle_plate, is_active, location_updated_at, profiles(full_name, avatar_url, phone), deliveries!deliveries_driver_id_fkey(id, status, delivered_at)").eq("restaurant_id", restaurantId).order("created_at"),
    supabase.from("driver_invites").select("id, email, token, expires_at, accepted_at").eq("restaurant_id", restaurantId).order("created_at", { ascending: false }),
  ]);
  if (driversResult.error) throw new Error(`Não foi possível carregar os estafetas: ${driversResult.error.message}`);
  if (invitesResult.error) throw new Error(`Não foi possível carregar os convites: ${invitesResult.error.message}`);
  return <RestaurantDriversClient initialDrivers={driversResult.data ?? []} initialInvites={invitesResult.data ?? []} />;
}
