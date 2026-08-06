"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function activateDriverModeAction() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc(
    "activate_current_user_as_driver"
  );

  if (error) {
    redirect(
      `/driver/dashboard?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/driver/dashboard");
  redirect("/driver/dashboard?activated=1");
}

export async function setDriverAvailabilityAction(
  status: "available" | "offline"
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("drivers")
    .update({ status })
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (error) {
    redirect(
      `/driver/dashboard?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/driver/dashboard");
  redirect("/driver/dashboard");
}
