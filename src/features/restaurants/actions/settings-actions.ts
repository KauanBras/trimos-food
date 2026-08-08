"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";

export type SettingsActionResult = {
  ok: boolean;
  message: string;
};

const allowedImageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function textValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optionalText(formData: FormData, name: string) {
  return textValue(formData, name) || null;
}

function numberValue(formData: FormData, name: string, fallback: number) {
  const value = Number(textValue(formData, name));
  return Number.isFinite(value) ? value : fallback;
}

async function uploadBrandingImage(
  formData: FormData,
  field: "logoFile" | "coverFile",
  restaurantId: string,
) {
  const file = formData.get(field);

  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  const extension = allowedImageTypes[file.type];
  if (!extension) {
    throw new Error("Use uma imagem JPG, PNG ou WebP.");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Cada imagem deve ter no máximo 8 MB.");
  }

  const supabase = await createClient();
  const kind = field === "logoFile" ? "logo" : "cover";
  const path = `${restaurantId}/${kind}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from("restaurant-branding")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`Não foi possível enviar a imagem: ${error.message}`);
  }

  return supabase.storage.from("restaurant-branding").getPublicUrl(path).data
    .publicUrl;
}

export async function updateRestaurantSettingsAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  try {
    const { restaurantId, role, restaurant } = await getCurrentRestaurant();

    if (!(["owner", "admin", "manager"] as string[]).includes(role)) {
      return {
        ok: false,
        message: "Não tem permissão para alterar as configurações.",
      };
    }

    const name = textValue(formData, "name");
    if (name.length < 2) {
      return { ok: false, message: "Indique o nome do restaurante." };
    }

    const supabase = await createClient();
    const [uploadedLogo, uploadedCover] = await Promise.all([
      uploadBrandingImage(formData, "logoFile", restaurantId),
      uploadBrandingImage(formData, "coverFile", restaurantId),
    ]);

    const removeLogo = formData.get("removeLogo") === "on";
    const removeCover = formData.get("removeCover") === "on";

    const logoUrl = removeLogo
      ? null
      : uploadedLogo ?? restaurant.logo_url ?? null;
    const coverUrl = removeCover
      ? null
      : uploadedCover ?? restaurant.cover_url ?? null;

    const { error: restaurantError } = await supabase
      .from("restaurants")
      .update({
        name,
        description: optionalText(formData, "description"),
        logo_url: logoUrl,
        cover_url: coverUrl,
        phone: optionalText(formData, "phone"),
        email: optionalText(formData, "email"),
        tax_number: optionalText(formData, "taxNumber"),
        address_line: optionalText(formData, "addressLine"),
        city: optionalText(formData, "city"),
        postal_code: optionalText(formData, "postalCode"),
        accepts_delivery: formData.get("acceptsDelivery") === "on",
        accepts_pickup: formData.get("acceptsPickup") === "on",
        accepts_dine_in: formData.get("acceptsDineIn") === "on",
        accepts_reservations: formData.get("acceptsReservations") === "on",
      })
      .eq("id", restaurantId);

    if (restaurantError) {
      throw new Error(restaurantError.message);
    }

    const { error: settingsError } = await supabase
      .from("restaurant_settings")
      .update({
        primary_color: textValue(formData, "primaryColor") || "#fbbf24",
        secondary_color:
          textValue(formData, "secondaryColor") || "#18181b",
        delivery_radius_km: Math.max(
          0,
          numberValue(formData, "deliveryRadiusKm", 5),
        ),
        minimum_order_amount: Math.max(
          0,
          numberValue(formData, "minimumOrderAmount", 0),
        ),
        default_delivery_fee: Math.max(
          0,
          numberValue(formData, "defaultDeliveryFee", 0),
        ),
        free_delivery_from:
          textValue(formData, "freeDeliveryFrom") === ""
            ? null
            : Math.max(0, numberValue(formData, "freeDeliveryFrom", 0)),
        default_preparation_minutes: Math.max(
          1,
          Math.round(numberValue(formData, "defaultPreparationMinutes", 30)),
        ),
        order_sound_enabled: formData.get("orderSoundEnabled") === "on",
        auto_accept_orders: formData.get("autoAcceptOrders") === "on",
        reservation_slot_minutes: Math.min(
          120,
          Math.max(
            15,
            Math.round(numberValue(formData, "reservationSlotMinutes", 30)),
          ),
        ),
        reservation_capacity: Math.min(
          500,
          Math.max(
            1,
            Math.round(numberValue(formData, "reservationCapacity", 30)),
          ),
        ),
        reservation_advance_days: Math.min(
          365,
          Math.max(
            1,
            Math.round(numberValue(formData, "reservationAdvanceDays", 60)),
          ),
        ),
        reservation_duration_minutes: Math.min(
          360,
          Math.max(
            30,
            Math.round(
              numberValue(formData, "reservationDurationMinutes", 90),
            ),
          ),
        ),
        auto_confirm_reservations:
          formData.get("autoConfirmReservations") === "on",
      })
      .eq("restaurant_id", restaurantId);

    if (settingsError) {
      throw new Error(settingsError.message);
    }

    const hours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
      restaurant_id: restaurantId,
      day_of_week: dayOfWeek,
      is_closed: formData.get(`day-${dayOfWeek}-open`) !== "on",
      opens_at: textValue(formData, `day-${dayOfWeek}-opens`) || null,
      closes_at: textValue(formData, `day-${dayOfWeek}-closes`) || null,
    }));

    const { error: hoursError } = await supabase
      .from("business_hours")
      .upsert(hours, { onConflict: "restaurant_id,day_of_week" });

    if (hoursError) {
      throw new Error(hoursError.message);
    }

    revalidatePath("/restaurant/settings");
    revalidatePath("/restaurant/dashboard");
    revalidatePath(`/r/${restaurant.slug}`);

    return { ok: true, message: "Configurações guardadas com sucesso." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível guardar as configurações.",
    };
  }
}
