import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function getCurrentRestaurant() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("restaurant_users")
    .select(`
      role,
      restaurant_id,
      restaurants (
        id,
        name,
        slug,
        status,
        logo_url,
        accepts_delivery,
        accepts_pickup,
        accepts_dine_in,
        accepts_reservations
      )
    `)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError) {
    throw new Error(
      `Não foi possível carregar o restaurante: ${membershipError.message}`
    );
  }

  if (!membership || !membership.restaurants) {
    redirect("/onboarding");
  }

  return {
    user,
    role: membership.role,
    restaurantId: membership.restaurant_id,
    restaurant: membership.restaurants,
  };
}
