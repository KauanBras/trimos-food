"use server";

import { revalidatePath } from "next/cache";

import { getWritableCurrentRestaurant } from "@/lib/restaurants/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

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

type SubmittedBusinessHour = {
  day_of_week: number;
  is_closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
  sort_order: number;
};

function timeMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function parseBusinessHours(formData: FormData): SubmittedBusinessHour[] {
  const parsed: unknown = JSON.parse(textValue(formData, "businessHoursJson") || "[]");
  if (!Array.isArray(parsed)) throw new Error("O horário semanal é inválido.");

  const rows = parsed.map((raw): SubmittedBusinessHour => {
    if (!raw || typeof raw !== "object") throw new Error("Existe um horário inválido.");
    const value = raw as Record<string, unknown>;
    const dayOfWeek = Number(value.day_of_week);
    const isClosed = value.is_closed === true;
    const sortOrder = Number(value.sort_order);
    const opensAt = isClosed ? null : String(value.opens_at ?? "");
    const closesAt = isClosed ? null : String(value.closes_at ?? "");

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) throw new Error("Existe um dia inválido no horário.");
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 3) throw new Error("Existe uma ordem inválida no horário.");
    if (!isClosed && (!/^\d{2}:\d{2}$/.test(opensAt ?? "") || !/^\d{2}:\d{2}$/.test(closesAt ?? "") || opensAt === closesAt)) {
      throw new Error("Todos os períodos abertos precisam de hora inicial e final diferentes.");
    }

    return { day_of_week: dayOfWeek, is_closed: isClosed, opens_at: opensAt, closes_at: closesAt, sort_order: sortOrder };
  });

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    const dayRows = rows.filter((row) => row.day_of_week === dayOfWeek);
    if (!dayRows.length || dayRows.length > 4) throw new Error("Configure todos os dias com até quatro horários.");
    if (dayRows.some((row) => row.is_closed)) {
      if (dayRows.length !== 1) throw new Error("Um dia fechado não pode ter horários abertos.");
      continue;
    }

    const intervals = dayRows
      .map((row) => {
        const start = timeMinutes(row.opens_at!);
        let end = timeMinutes(row.closes_at!);
        if (end <= start) end += 24 * 60;
        return { start, end };
      })
      .sort((a, b) => a.start - b.start);
    if (intervals.some((interval, index) => index > 0 && interval.start < intervals[index - 1].end)) {
      throw new Error("Existem horários sobrepostos no mesmo dia.");
    }
  }

  return rows;
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
    const { restaurantId, role, restaurant } =
      await getWritableCurrentRestaurant();

    if (!(["owner", "admin", "manager"] as string[]).includes(role)) {
      return {
        ok: false,
        message: "Não tem permissão para alterar as configurações.",
      };
    }

    const supabase = await createClient();
    const identitySectionPresent = formData.has("identitySectionPresent");
    const operationSectionPresent = formData.has("operationSectionPresent");
    const reservationsSectionPresent = formData.has("reservationsSectionPresent");
    const paymentsSectionPresent = formData.has("paymentsSectionPresent");
    const hoursSectionPresent = formData.has("hoursSectionPresent");

    if (identitySectionPresent) {
      const name = textValue(formData, "name") || restaurant.name;
      if (name.length < 2) {
        return { ok: false, message: "Indique o nome do restaurante." };
      }

      const [uploadedLogo, uploadedCover] = await Promise.all([
        uploadBrandingImage(formData, "logoFile", restaurantId),
        uploadBrandingImage(formData, "coverFile", restaurantId),
      ]);
      const removeLogo = formData.get("removeLogo") === "on";
      const removeCover = formData.get("removeCover") === "on";
      const { error: identityError } = await supabase
        .from("restaurants")
        .update({
          name,
          description: optionalText(formData, "description"),
          logo_url: removeLogo ? null : uploadedLogo ?? restaurant.logo_url ?? null,
          cover_url: removeCover ? null : uploadedCover ?? restaurant.cover_url ?? null,
          phone: optionalText(formData, "phone"),
          email: optionalText(formData, "email"),
          tax_number: optionalText(formData, "taxNumber"),
          address_line: optionalText(formData, "addressLine"),
          city: optionalText(formData, "city"),
          postal_code: optionalText(formData, "postalCode"),
        })
        .eq("id", restaurantId);
      if (identityError) throw new Error(identityError.message);
    }

    if (operationSectionPresent) {
      const { error: operationError } = await supabase
        .from("restaurants")
        .update({
          accepts_delivery: formData.get("acceptsDelivery") === "on",
          accepts_pickup: formData.get("acceptsPickup") === "on",
          accepts_dine_in: formData.get("acceptsDineIn") === "on",
          accepts_reservations: formData.get("acceptsReservations") === "on",
        })
        .eq("id", restaurantId);
      if (operationError) throw new Error(operationError.message);
    }

    const settingsUpdates: Database["public"]["Tables"]["restaurant_settings"]["Update"] = {};

    if (identitySectionPresent) {
      settingsUpdates.primary_color = textValue(formData, "primaryColor") || "#fbbf24";
      settingsUpdates.secondary_color = textValue(formData, "secondaryColor") || "#18181b";
    }

    if (operationSectionPresent) {
      const deliveryOriginLatitude = textValue(formData, "deliveryOriginLatitude");
      const deliveryOriginLongitude = textValue(formData, "deliveryOriginLongitude");
      const deliveryFeePerKm = Math.max(0, numberValue(formData, "deliveryFeePerKm", 0));
      const submittedPaperWidth = Math.round(numberValue(formData, "receiptPaperWidth", 80));
      const receiptPaperWidth = submittedPaperWidth === 58 ? 58 : 80;
      if ((deliveryOriginLatitude === "") !== (deliveryOriginLongitude === "")) {
        return { ok: false, message: "Defina novamente a localização de partida das entregas." };
      }
      if (deliveryFeePerKm > 0 && !deliveryOriginLatitude) {
        return { ok: false, message: "Use a localização atual do restaurante antes de ativar o preço por quilómetro." };
      }
      const parsedLatitude = deliveryOriginLatitude === "" ? null : Number(deliveryOriginLatitude);
      const parsedLongitude = deliveryOriginLongitude === "" ? null : Number(deliveryOriginLongitude);
      if (
        (parsedLatitude !== null && (!Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90))
        || (parsedLongitude !== null && (!Number.isFinite(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180))
      ) {
        return { ok: false, message: "A localização de partida das entregas é inválida." };
      }

      Object.assign(settingsUpdates, {
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
        delivery_fee_per_km: deliveryFeePerKm,
        delivery_origin_latitude: parsedLatitude,
        delivery_origin_longitude: parsedLongitude,
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
        receipt_printer_enabled: formData.get("receiptPrinterEnabled") === "on",
        receipt_paper_width: receiptPaperWidth,
        receipt_print_copies: Math.min(
          3,
          Math.max(1, Math.round(numberValue(formData, "receiptPrintCopies", 1))),
        ),
        auto_print_orders: formData.get("autoPrintOrders") === "on",
      });
    }

    if (reservationsSectionPresent) {
      const discountEnabled = formData.get("reservationDiscountEnabled") === "on";
      const discountPercentText = textValue(formData, "reservationDiscountPercent");
      const discountPercent = discountPercentText === "" ? null : Number(discountPercentText);
      const discountStartsOn = optionalText(formData, "reservationDiscountStartsOn");
      const discountEndsOn = optionalText(formData, "reservationDiscountEndsOn");
      const discountStartTime = optionalText(formData, "reservationDiscountStartTime");
      const discountEndTime = optionalText(formData, "reservationDiscountEndTime");
      const submittedDiscountDays = Array.from(new Set(
        formData.getAll("reservationDiscountDays").map(Number),
      )).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

      if (discountEnabled && (discountPercent === null || !Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 90)) {
        return { ok: false, message: "Indique um desconto de reserva entre 1% e 90%." };
      }
      if (discountEnabled && submittedDiscountDays.length === 0) {
        return { ok: false, message: "Escolha pelo menos um dia para a oferta de reserva." };
      }
      if ((discountStartTime === null) !== (discountEndTime === null)) {
        return { ok: false, message: "Preencha a hora inicial e final da oferta, ou deixe ambas vazias." };
      }
      if (discountStartTime && (!/^\d{2}:\d{2}$/.test(discountStartTime) || !/^\d{2}:\d{2}$/.test(discountEndTime ?? "") || discountStartTime === discountEndTime)) {
        return { ok: false, message: "O período da oferta de reserva é inválido." };
      }
      if (discountStartsOn && !/^\d{4}-\d{2}-\d{2}$/.test(discountStartsOn)) {
        return { ok: false, message: "A data inicial da oferta é inválida." };
      }
      if (discountEndsOn && !/^\d{4}-\d{2}-\d{2}$/.test(discountEndsOn)) {
        return { ok: false, message: "A data final da oferta é inválida." };
      }
      if (discountStartsOn && discountEndsOn && discountStartsOn > discountEndsOn) {
        return { ok: false, message: "A data final da oferta deve ser posterior à data inicial." };
      }

      Object.assign(settingsUpdates, {
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
        reservation_discount_enabled: discountEnabled,
        reservation_discount_percent: discountPercent,
        reservation_discount_description:
          optionalText(formData, "reservationDiscountDescription"),
        reservation_discount_starts_on: discountStartsOn,
        reservation_discount_ends_on: discountEndsOn,
        reservation_discount_days:
          submittedDiscountDays.length > 0
            ? submittedDiscountDays
            : [0, 1, 2, 3, 4, 5, 6],
        reservation_discount_start_time: discountStartTime,
        reservation_discount_end_time: discountEndTime,
      });
    }

    if (paymentsSectionPresent) {
      const acceptsCash = formData.get("acceptsCash") === "on";
      const acceptsTerminal = formData.get("acceptsTerminal") === "on";
      const wantsMbWay = formData.get("acceptsMbWay") === "on";
      if (!acceptsCash && !acceptsTerminal && !wantsMbWay) {
        return { ok: false, message: "Ative pelo menos uma forma de pagamento." };
      }
      const driverPoolMode = textValue(formData, "driverPoolMode");
      if (!["private", "network", "hybrid"].includes(driverPoolMode)) {
        return { ok: false, message: "Escolha uma modalidade válida para os estafetas." };
      }
      const driverFeeBase = textValue(formData, "driverFeeBase");
      const driverFeePerKm = textValue(formData, "driverFeePerKm");
      if ((driverFeeBase === "") !== (driverFeePerKm === "")) {
        return { ok: false, message: "Preencha os dois valores do ganho do estafeta ou deixe ambos vazios." };
      }
      if (wantsMbWay) {
        const { data: paymentSettings } = await supabase
          .from("restaurant_settings")
          .select("stripe_charges_enabled, stripe_details_submitted, stripe_mb_way_enabled")
          .eq("restaurant_id", restaurantId)
          .single();
        if (!paymentSettings?.stripe_charges_enabled || !paymentSettings.stripe_details_submitted || !paymentSettings.stripe_mb_way_enabled) {
          return { ok: false, message: "Conclua primeiro a ligação da conta Stripe para ativar o MB WAY." };
        }
      }
      Object.assign(settingsUpdates, {
        accepts_cash: acceptsCash,
        accepts_terminal: acceptsTerminal,
        accepts_mb_way: wantsMbWay,
        driver_pool_mode: driverPoolMode as Database["public"]["Enums"]["driver_pool_mode"],
        driver_fee_base: driverFeeBase === "" ? null : Math.max(0, Number(driverFeeBase)),
        driver_fee_per_km: driverFeePerKm === "" ? null : Math.max(0, Number(driverFeePerKm)),
      });
    }

    if (Object.keys(settingsUpdates).length > 0) {
      const { error: settingsError } = await supabase
        .from("restaurant_settings")
        .update(settingsUpdates)
        .eq("restaurant_id", restaurantId);
      if (settingsError) throw new Error(settingsError.message);
    }

    if (hoursSectionPresent) {
      const hours = parseBusinessHours(formData);
      const { error: hoursError } = await supabase.rpc("replace_restaurant_business_hours", {
        requested_restaurant_id: restaurantId,
        requested_schedule: hours,
      });
      if (hoursError) throw new Error(hoursError.message);
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
