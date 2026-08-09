"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function createSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createRestaurantAction(formData: FormData) {
  const rawName = formData.get("restaurantName");

  if (
    typeof rawName !== "string" ||
    rawName.trim().length < 2 ||
    rawName.trim().length > 100
  ) {
    redirect(
      `/onboarding?error=${encodeURIComponent(
        "Indique um nome entre 2 e 100 caracteres.",
      )}`,
    );
  }

  const restaurantName = rawName.trim();
  const restaurantSlug = createSlug(restaurantName);

  if (!restaurantSlug) {
    redirect(
      `/onboarding?error=${encodeURIComponent(
        "Não foi possível gerar um endereço válido.",
      )}`,
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: restaurantId, error } = await supabase.rpc(
    "create_restaurant_for_current_user",
    {
      restaurant_name: restaurantName,
      restaurant_slug: restaurantSlug,
    },
  );

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  if (restaurantId) {
    await supabase.rpc("record_platform_audit", {
      requested_restaurant_id: restaurantId,
      requested_action: "restaurant.created",
      requested_entity_type: "restaurant",
      requested_entity_id: restaurantId,
      requested_metadata: { source: "self_service_onboarding" },
    });
  }

  redirect("/restaurant/billing");
}
