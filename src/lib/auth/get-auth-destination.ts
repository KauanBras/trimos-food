import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type AppSupabaseClient = SupabaseClient<Database>;

export async function getAuthDestination(
  supabase: AppSupabaseClient,
  userId: string
) {
  /*
   * Um utilizador com perfil de estafeta deve entrar diretamente
   * no painel do estafeta, mesmo que não seja proprietário.
   */
  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select("id, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (driverError) {
    throw new Error(
      `Não foi possível verificar o perfil de estafeta: ${driverError.message}`
    );
  }

  if (driver) {
    return "/driver/dashboard";
  }

  /*
   * Proprietários e restantes membros do restaurante entram
   * pelo painel do restaurante.
   */
  const { data: membership, error: membershipError } = await supabase
    .from("restaurant_users")
    .select("restaurant_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError) {
    throw new Error(
      `Não foi possível verificar o restaurante: ${membershipError.message}`
    );
  }

  if (membership) {
    return "/restaurant/dashboard";
  }

  /*
   * Conta confirmada, mas ainda sem vínculo operacional.
   * Neste momento o único onboarding disponível é o de restaurante.
   */
  return "/onboarding";
}
