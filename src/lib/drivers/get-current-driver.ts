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
      is_active
    `)
    .eq("user_id", user.id)
    .eq("is_active", true)
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
