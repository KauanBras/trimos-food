"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CURRENT_RESTAURANT_COOKIE } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export async function selectRestaurantAction(formData: FormData) {
  const restaurantId = String(formData.get("restaurantId") ?? "").trim();
  const requestedDestination = String(
    formData.get("destination") ?? "/restaurant/dashboard",
  );
  const destination = requestedDestination.startsWith("/restaurant")
    ? requestedDestination
    : "/restaurant/dashboard";

  if (!restaurantId) {
    redirect("/restaurant/switch?error=Selecione%20um%20restaurante.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("restaurant_users")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    redirect("/restaurant/switch?error=Acesso%20não%20autorizado.");
  }

  const cookieStore = await cookies();
  cookieStore.set(CURRENT_RESTAURANT_COOKIE, restaurantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect(destination);
}
