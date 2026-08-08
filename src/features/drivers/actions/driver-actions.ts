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
  const networkEnabled = formData.get("networkEnabled") === "on";
  const networkRadiusKm = Math.min(100, Math.max(1, Number(formData.get("networkRadiusKm") ?? 10)));
  const payoutMethod = String(formData.get("payoutMethod") ?? "mb_way");
  const payoutPhone = String(formData.get("payoutPhone") ?? "").trim();
  const payoutIban = String(formData.get("payoutIban") ?? "").replace(/\s+/g, "").toUpperCase();

  if (fullName.length < 2 || phone.length < 6) {
    redirect("/driver/perfil?error=Preencha%20o%20nome%20e%20o%20telefone.");
  }
  if (!["mb_way", "bank_transfer", "cash"].includes(payoutMethod)) {
    redirect("/driver/perfil?error=Escolha%20uma%20forma%20de%20recebimento%20válida.");
  }
  if (payoutMethod === "mb_way" && payoutPhone.length < 6) {
    redirect("/driver/perfil?error=Indique%20o%20telefone%20MB%20WAY.");
  }
  if (payoutMethod === "bank_transfer" && payoutIban.length < 15) {
    redirect("/driver/perfil?error=Indique%20um%20IBAN%20válido.");
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
      is_network_enabled: networkEnabled,
      network_enabled_at: networkEnabled ? new Date().toISOString() : null,
      network_radius_km: networkRadiusKm,
      payout_method: payoutMethod as "mb_way" | "bank_transfer" | "cash",
      payout_phone: payoutPhone || null,
      payout_iban: payoutIban || null,
    })
    .eq("user_id", user.id)
    .eq("is_active", true);
  if (driverError) {
    redirect(`/driver/perfil?error=${encodeURIComponent(driverError.message)}`);
  }

  revalidatePath("/driver", "layout");
  redirect("/driver/perfil?saved=1");
}
