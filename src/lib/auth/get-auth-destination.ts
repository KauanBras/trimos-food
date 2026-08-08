import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type AppSupabaseClient = SupabaseClient<Database>;

export async function getAuthDestination(
  supabase: AppSupabaseClient,
  userId: string,
) {
  const [
    { data: driver, error: driverError },
    { data: membership, error: membershipError },
    { data: profile, error: profileError },
  ] = await Promise.all([
    supabase
      .from("drivers")
      .select("id, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),

    supabase
      .from("restaurant_users")
      .select("restaurant_id, role")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),

    supabase
      .from("profiles")
      .select("platform_role")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (driverError) {
    throw new Error(
      `Não foi possível verificar o perfil de estafeta: ${driverError.message}`,
    );
  }

  if (membershipError) {
    throw new Error(
      `Não foi possível verificar o restaurante: ${membershipError.message}`,
    );
  }

  if (profileError) {
    throw new Error(
      `Não foi possível verificar o acesso à plataforma: ${profileError.message}`,
    );
  }

  const isPlatformAdmin = profile?.platform_role === "super_admin";

  /*
   * Se a mesma conta tiver os dois perfis,
   * o utilizador escolhe em qual operação pretende entrar.
   */
  if (
    [Boolean(driver), Boolean(membership), isPlatformAdmin].filter(Boolean)
      .length > 1
  ) {
    return "/select-role";
  }

  if (isPlatformAdmin) {
    return "/admin";
  }

  if (membership) {
    return "/restaurant/dashboard";
  }

  if (driver) {
    return "/driver/dashboard";
  }

  return "/onboarding";
}
