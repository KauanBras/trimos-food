"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export type DriverManagementResult = {
  ok: boolean;
  message: string;
  token?: string;
};

function canManage(role: string) {
  return ["owner", "admin", "manager"].includes(role);
}

export async function createDriverInviteAction(email: string): Promise<DriverManagementResult> {
  try {
    const { restaurantId, role, user } = await getCurrentRestaurant();
    if (!canManage(role)) return { ok: false, message: "Não tem permissão para convidar estafetas." };
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return { ok: false, message: "Indique um e-mail válido." };

    const supabase = await createClient();
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("driver_invites").upsert({
      restaurant_id: restaurantId,
      email: normalizedEmail,
      token,
      created_by: user.id,
      expires_at: expiresAt,
      accepted_at: null,
      accepted_by: null,
    }, { onConflict: "restaurant_id,email" });

    if (error) throw new Error(error.message);
    revalidatePath("/restaurant/drivers");
    return { ok: true, message: "Convite criado. Copie e envie o link ao estafeta.", token };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível criar o convite." };
  }
}

export async function cancelDriverInviteAction(inviteId: string): Promise<DriverManagementResult> {
  try {
    const { restaurantId, role } = await getCurrentRestaurant();
    if (!canManage(role)) return { ok: false, message: "Não tem permissão para cancelar convites." };
    const supabase = await createClient();
    const { error } = await supabase.from("driver_invites").delete().eq("id", inviteId).eq("restaurant_id", restaurantId).is("accepted_at", null);
    if (error) throw new Error(error.message);
    revalidatePath("/restaurant/drivers");
    return { ok: true, message: "Convite cancelado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível cancelar o convite." };
  }
}

export async function setDriverActiveAction(driverId: string, active: boolean): Promise<DriverManagementResult> {
  try {
    const { restaurantId, role } = await getCurrentRestaurant();
    if (!canManage(role)) return { ok: false, message: "Não tem permissão para gerir estafetas." };
    const supabase = await createClient();
    const { data: driver } = await supabase.from("drivers").select("status").eq("id", driverId).eq("restaurant_id", restaurantId).maybeSingle();
    if (!driver) return { ok: false, message: "Estafeta não encontrado." };
    if (!active && driver.status === "busy") return { ok: false, message: "Conclua a entrega ativa antes de suspender este estafeta." };
    const { error } = await supabase.from("drivers").update({ is_active: active, status: active ? "offline" : "suspended" }).eq("id", driverId).eq("restaurant_id", restaurantId);
    if (error) throw new Error(error.message);
    revalidatePath("/restaurant/drivers");
    return { ok: true, message: active ? "Estafeta reativado." : "Estafeta suspenso." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível atualizar o estafeta." };
  }
}
