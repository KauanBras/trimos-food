import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function getCurrentDriver() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: driver, error } = await supabase
    .from("drivers")
    .select(`
      id,
      restaurant_id,
      status,
      vehicle_type,
      vehicle_plate,
      phone,
      is_active,
      is_network_enabled,
      network_radius_km,
      payout_method,
      payout_phone,
      payout_iban
    `)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Não foi possível carregar o perfil do estafeta: ${error.message}`
    );
  }

  return {
    user,
    driver,
  };
}
