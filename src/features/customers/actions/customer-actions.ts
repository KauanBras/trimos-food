"use server";

import { revalidatePath } from "next/cache";

import { getWritableCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export type CustomerActionResult = { ok: boolean; message: string };

function canManage(role: string) {
  return ["owner", "admin", "manager", "staff"].includes(role);
}

export async function updateCustomerAction(
  customerId: string,
  values: { name: string; email: string; phone: string; notes: string; tags: string[]; isBlocked: boolean },
): Promise<CustomerActionResult> {
  try {
    const { restaurantId, role } = await getWritableCurrentRestaurant();
    if (!canManage(role)) return { ok: false, message: "Não tem permissão para editar clientes." };
    if (values.name.trim().length < 2) return { ok: false, message: "Indique o nome do cliente." };
    if (!values.phone.trim() && !values.email.trim()) return { ok: false, message: "Indique um telefone ou e-mail." };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .update({
        name: values.name.trim(),
        phone: values.phone.trim() || null,
        email: values.email.trim().toLowerCase() || null,
        notes: values.notes.trim() || null,
        tags: values.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 12),
        is_blocked: values.isBlocked,
      })
      .eq("id", customerId)
      .eq("restaurant_id", restaurantId)
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return { ok: false, message: "Cliente não encontrado." };
    revalidatePath("/restaurant/customers");
    return { ok: true, message: "Cliente atualizado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível atualizar o cliente." };
  }
}
