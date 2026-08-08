"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function getText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function submitCommercialLeadAction(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_commercial_lead", {
    requested_contact_name: getText(formData, "contactName"),
    requested_restaurant_name: getText(formData, "restaurantName"),
    requested_email: getText(formData, "email"),
    requested_phone: getText(formData, "phone") || undefined,
    requested_city: getText(formData, "city") || undefined,
    requested_message: getText(formData, "message") || undefined,
  });

  if (error) {
    redirect(`/contact?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/contact?success=1");
}
