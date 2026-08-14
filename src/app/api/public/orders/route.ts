import { NextResponse } from "next/server";
import { z } from "zod";

import { consumePublicRateLimit } from "@/lib/security/public-rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const modifierSchema = z.object({
  optionId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});

const itemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  modifiers: z.array(modifierSchema).max(50),
  quantity: z.number().int().min(1).max(99),
  notes: z.string().trim().max(500),
});

const orderSchema = z.object({
  requested_restaurant_id: z.string().uuid(),
  requested_customer_name: z.string().trim().min(2).max(120),
  requested_customer_phone: z.string().trim().min(6).max(30),
  requested_customer_email: z.string().trim().max(254),
  requested_type: z.enum(["delivery", "pickup", "dine_in"]),
  requested_delivery_address: z.string().trim().max(300),
  requested_delivery_latitude: z.number().min(-90).max(90).nullable(),
  requested_delivery_longitude: z.number().min(-180).max(180).nullable(),
  requested_notes: z.string().trim().max(1000),
  requested_items: z.array(itemSchema).min(1).max(50),
  requested_payment_method: z.enum(["cash", "terminal", "mb_way"]),
  requested_cash_tendered_amount: z.number().min(0).max(100000).nullable(),
  website: z.string().max(0).optional(),
});

export async function POST(request: Request) {
  try {
    if (!(await consumePublicRateLimit(request, "create_order", 8, 600))) {
      return NextResponse.json(
        { error: "Foram feitas demasiadas tentativas. Aguarde alguns minutos." },
        { status: 429 },
      );
    }

    const parsed = orderSchema.safeParse(await request.json());
    if (!parsed.success || parsed.data.website) {
      return NextResponse.json({ error: "Revise os dados do pedido." }, { status: 400 });
    }
    const args = {
      requested_restaurant_id: parsed.data.requested_restaurant_id,
      requested_customer_name: parsed.data.requested_customer_name,
      requested_customer_phone: parsed.data.requested_customer_phone,
      requested_customer_email: parsed.data.requested_customer_email,
      requested_type: parsed.data.requested_type,
      requested_delivery_address: parsed.data.requested_delivery_address,
      requested_delivery_latitude: parsed.data.requested_delivery_latitude,
      requested_delivery_longitude: parsed.data.requested_delivery_longitude,
      requested_notes: parsed.data.requested_notes,
      requested_items: parsed.data.requested_items,
      requested_payment_method: parsed.data.requested_payment_method,
      requested_cash_tendered_amount: parsed.data.requested_cash_tendered_amount,
    };
    const { data, error } = await createAdminClient().rpc("create_public_order", args);
    if (error || !data?.[0]) {
      return NextResponse.json({ error: error?.message ?? "Não foi possível criar o pedido." }, { status: 400 });
    }
    return NextResponse.json(data[0], { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível criar o pedido." },
      { status: 500 },
    );
  }
}
