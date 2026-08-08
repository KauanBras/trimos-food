import { CustomersClient } from "@/features/customers/components/customers-client";
import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export default async function CustomersPage() {
  const { restaurantId, restaurant } = await getCurrentRestaurant();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, phone, email, notes, tags, is_blocked, created_at, orders(id, total, status, type, created_at), reservations(id, status, reservation_date, party_size)")
    .eq("restaurant_id", restaurantId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Não foi possível carregar os clientes: ${error.message}`);
  return <CustomersClient initialCustomers={data ?? []} currencyCode={restaurant.currency_code} />;
}
