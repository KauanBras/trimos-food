import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, platform_role")
    .eq("id", user.id)
    .single();

  if (error || profile?.platform_role !== "super_admin") {
    redirect("/restaurant/dashboard");
  }

  return { supabase, user, profile };
}

export async function getOptionalPlatformRole() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("platform_role")
    .eq("id", user.id)
    .maybeSingle();

  return data?.platform_role ?? null;
}
