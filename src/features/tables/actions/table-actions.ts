"use server";

import { revalidatePath } from "next/cache";

import { getWritableCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export type TableActionResult = { ok: boolean; message: string };

function canManage(role: string) {
  return ["owner", "admin", "manager"].includes(role);
}

function newTableCode() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
}

export async function createTablesAction(
  prefix: string,
  quantity: number,
  seats: number,
): Promise<TableActionResult> {
  try {
    const { restaurantId, role } = await getWritableCurrentRestaurant();
    if (!canManage(role)) return { ok: false, message: "Não tem permissão para gerir mesas." };
    const cleanPrefix = prefix.trim().slice(0, 40) || "Mesa";
    const safeQuantity = Math.min(100, Math.max(1, Math.floor(quantity)));
    const safeSeats = Math.min(100, Math.max(1, Math.floor(seats)));
    const supabase = await createClient();
    const { data: current, error: readError } = await supabase
      .from("restaurant_tables")
      .select("name, sort_order")
      .eq("restaurant_id", restaurantId);
    if (readError) throw new Error(readError.message);
    const escapedPrefix = cleanPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp(`^${escapedPrefix}\\s+(\\d+)$`, "i");
    const highestNumber = (current ?? []).reduce((highest, table) => {
      const match = table.name.match(expression);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    const highestOrder = (current ?? []).reduce(
      (highest, table) => Math.max(highest, table.sort_order),
      -1,
    );
    const rows = Array.from({ length: safeQuantity }, (_, index) => ({
      restaurant_id: restaurantId,
      name: `${cleanPrefix} ${highestNumber + index + 1}`,
      code: newTableCode(),
      seats: safeSeats,
      sort_order: highestOrder + index + 1,
      is_active: true,
    }));
    const { error } = await supabase.from("restaurant_tables").insert(rows);
    if (error) throw new Error(error.message);
    revalidatePath("/restaurant/tables");
    return { ok: true, message: `${safeQuantity} QR Code${safeQuantity > 1 ? "s" : ""} criado${safeQuantity > 1 ? "s" : ""}.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível criar as mesas." };
  }
}

export async function setTableActiveAction(
  tableId: string,
  active: boolean,
): Promise<TableActionResult> {
  try {
    const { restaurantId, role } = await getWritableCurrentRestaurant();
    if (!canManage(role)) return { ok: false, message: "Não tem permissão para gerir mesas." };
    const supabase = await createClient();
    const { error } = await supabase.from("restaurant_tables").update({ is_active: active }).eq("id", tableId).eq("restaurant_id", restaurantId);
    if (error) throw new Error(error.message);
    revalidatePath("/restaurant/tables");
    return { ok: true, message: active ? "Mesa reativada." : "QR Code desativado." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível atualizar a mesa." };
  }
}

export async function regenerateTableCodeAction(tableId: string): Promise<TableActionResult> {
  try {
    const { restaurantId, role } = await getWritableCurrentRestaurant();
    if (!canManage(role)) return { ok: false, message: "Não tem permissão para gerir mesas." };
    const supabase = await createClient();
    const { error } = await supabase.from("restaurant_tables").update({ code: newTableCode(), is_active: true }).eq("id", tableId).eq("restaurant_id", restaurantId);
    if (error) throw new Error(error.message);
    revalidatePath("/restaurant/tables");
    return { ok: true, message: "Novo QR Code criado. O anterior deixou de funcionar." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível renovar o QR Code." };
  }
}

export async function deleteTableAction(tableId: string): Promise<TableActionResult> {
  try {
    const { restaurantId, role } = await getWritableCurrentRestaurant();
    if (!canManage(role)) return { ok: false, message: "Não tem permissão para gerir mesas." };
    const supabase = await createClient();
    const { error } = await supabase.from("restaurant_tables").delete().eq("id", tableId).eq("restaurant_id", restaurantId);
    if (error) throw new Error(error.message);
    revalidatePath("/restaurant/tables");
    return { ok: true, message: "Mesa removida." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível remover a mesa." };
  }
}
