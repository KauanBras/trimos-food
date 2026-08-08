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

export async function updateDriverProfileAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const vehicleType = String(formData.get("vehicleType") ?? "").trim();
  const vehiclePlate = String(formData.get("vehiclePlate") ?? "").trim().toUpperCase();

  if (fullName.length < 2 || phone.length < 6) {
    redirect("/driver/perfil?error=Preencha%20o%20nome%20e%20o%20telefone.");
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone })
    .eq("id", user.id);
  if (profileError) {
    redirect(`/driver/perfil?error=${encodeURIComponent(profileError.message)}`);
  }

  const { error: driverError } = await supabase
    .from("drivers")
    .update({
      phone,
      vehicle_type: vehicleType || null,
      vehicle_plate: vehiclePlate || null,
    })
    .eq("user_id", user.id)
    .eq("is_active", true);
  if (driverError) {
    redirect(`/driver/perfil?error=${encodeURIComponent(driverError.message)}`);
  }

  revalidatePath("/driver", "layout");
  redirect("/driver/perfil?saved=1");
}
