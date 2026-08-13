import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const CURRENT_RESTAURANT_COOKIE = "trimos_restaurant_id";

export async function getSelectedRestaurantId(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data: memberships, error } = await supabase
    .from("restaurant_users")
    .select("restaurant_id, restaurants(is_demo)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Não foi possível carregar os restaurantes: ${error.message}`);
  }

  const cookieStore = await cookies();
  const selectedRestaurantId = cookieStore.get(CURRENT_RESTAURANT_COOKIE)?.value;
  return (
    memberships?.find((item) => item.restaurant_id === selectedRestaurantId)
      ?.restaurant_id ??
    memberships?.find((item) => item.restaurants && !item.restaurants.is_demo)
      ?.restaurant_id ??
    memberships?.[0]?.restaurant_id ??
    null
  );
}

export async function getRestaurantMemberships() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberships, error } = await supabase
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
        cover_url,
        description,
        phone,
        email,
        address_line,
        city,
        postal_code,
        currency_code,
        timezone,
        accepts_delivery,
        accepts_pickup,
        accepts_dine_in,
        accepts_reservations,
        is_demo,
        demo_locked
      )
    `)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Não foi possível carregar os restaurantes: ${error.message}`);
  }

  return { supabase, user, memberships: memberships ?? [] };
}

export async function getCurrentRestaurant() {
  const { supabase, user, memberships } = await getRestaurantMemberships();

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const cookieStore = await cookies();
  const selectedRestaurantId = cookieStore.get(CURRENT_RESTAURANT_COOKIE)?.value;
  const membership =
    memberships.find(
      (item) =>
        item.restaurant_id === selectedRestaurantId && item.restaurants,
    ) ??
    memberships.find(
      (item) => item.restaurants && !item.restaurants.is_demo,
    ) ??
    memberships.find((item) => item.restaurants);

  if (!membership?.restaurants) {
    redirect("/onboarding");
  }

  return {
    supabase,
    user,
    role: membership.role,
    restaurantId: membership.restaurant_id,
    restaurant: membership.restaurants,
    membershipCount: memberships.length,
  };
}

export async function getWritableCurrentRestaurant() {
  const context = await getCurrentRestaurant();

  if (context.restaurant.is_demo && context.restaurant.demo_locked) {
    throw new Error(
      "Esta demonstração está protegida. A administração Trimos pode repor ou desbloquear os dados.",
    );
  }

  return context;
}
