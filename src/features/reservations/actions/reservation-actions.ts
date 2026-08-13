"use server";

import { revalidatePath } from "next/cache";

import { getWritableCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ReservationStatus = Database["public"]["Enums"]["reservation_status"];

export type ReservationActionResult = {
  ok: boolean;
  message: string;
};

function text(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

function canManage(role: string) {
  return ["owner", "admin", "manager", "staff"].includes(role);
}

export async function createReservationAction(
  formData: FormData,
): Promise<ReservationActionResult> {
  try {
    const { restaurantId, role, user } = await getWritableCurrentRestaurant();
    if (!canManage(role)) {
      return { ok: false, message: "Não tem permissão para criar reservas." };
    }

    const customerName = text(formData, "customerName");
    const customerPhone = text(formData, "customerPhone");
    const reservationDate = text(formData, "reservationDate");
    const reservationTime = text(formData, "reservationTime");
    const partySize = Number(text(formData, "partySize"));

    if (customerName.length < 2 || customerPhone.length < 6) {
      return { ok: false, message: "Revise o nome e o telefone do cliente." };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reservationDate) || !/^\d{2}:\d{2}$/.test(reservationTime)) {
      return { ok: false, message: "Escolha uma data e um horário válidos." };
    }
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 50) {
      return { ok: false, message: "Indique um número válido de pessoas." };
    }

    const supabase = await createClient();
    const { data: settings } = await supabase
      .from("restaurant_settings")
      .select("reservation_duration_minutes")
      .eq("restaurant_id", restaurantId)
      .single();

    const { error } = await supabase.from("reservations").insert({
      restaurant_id: restaurantId,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: text(formData, "customerEmail") || null,
      reservation_date: reservationDate,
      reservation_time: reservationTime,
      party_size: partySize,
      duration_minutes: settings?.reservation_duration_minutes ?? 90,
      table_label: text(formData, "tableLabel") || null,
      status: "confirmed",
      source: "dashboard",
      special_requests: text(formData, "specialRequests") || null,
      internal_notes: text(formData, "internalNotes") || null,
      created_by: user.id,
    });

    if (error) throw new Error(error.message);
    revalidatePath("/restaurant/reservations");
    revalidatePath("/restaurant/customers");
    revalidatePath("/restaurant/dashboard");
    return { ok: true, message: "Reserva criada e confirmada." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Não foi possível criar a reserva.",
    };
  }
}

export async function updateReservationStatusAction(
  reservationId: string,
  status: ReservationStatus,
): Promise<ReservationActionResult> {
  const allowedStatuses: ReservationStatus[] = [
    "pending",
    "confirmed",
    "seated",
    "completed",
    "cancelled",
    "no_show",
  ];

  if (!allowedStatuses.includes(status)) {
    return { ok: false, message: "Estado de reserva inválido." };
  }

  try {
    const { restaurantId, role } = await getWritableCurrentRestaurant();
    if (!canManage(role)) {
      return { ok: false, message: "Não tem permissão para alterar reservas." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reservations")
      .update({ status })
      .eq("id", reservationId)
      .eq("restaurant_id", restaurantId)
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return { ok: false, message: "Reserva não encontrada." };

    revalidatePath("/restaurant/reservations");
    revalidatePath("/restaurant/dashboard");
    return { ok: true, message: "Estado da reserva atualizado." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Não foi possível atualizar a reserva.",
    };
  }
}

export async function updateReservationDetailsAction(
  reservationId: string,
  tableLabel: string,
  internalNotes: string,
): Promise<ReservationActionResult> {
  try {
    const { restaurantId, role } = await getWritableCurrentRestaurant();
    if (!canManage(role)) {
      return { ok: false, message: "Não tem permissão para alterar reservas." };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("reservations")
      .update({
        table_label: tableLabel.trim() || null,
        internal_notes: internalNotes.trim() || null,
      })
      .eq("id", reservationId)
      .eq("restaurant_id", restaurantId);

    if (error) throw new Error(error.message);
    revalidatePath("/restaurant/reservations");
    return { ok: true, message: "Detalhes da reserva guardados." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Não foi possível guardar os detalhes.",
    };
  }
}
