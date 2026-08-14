import { NextResponse } from "next/server";
import { z } from "zod";

import { consumePublicRateLimit } from "@/lib/security/public-rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const reservationSchema = z.object({
  requested_restaurant_id: z.string().uuid(),
  requested_customer_name: z.string().trim().min(2).max(120),
  requested_customer_phone: z.string().trim().min(6).max(30),
  requested_customer_email: z.string().trim().max(254),
  requested_date: z.iso.date(),
  requested_time: z.iso.time({ precision: -1 }),
  requested_party_size: z.number().int().min(1).max(50),
  requested_special_requests: z.string().trim().max(1000),
  website: z.string().max(0).optional(),
});

export async function POST(request: Request) {
  try {
    if (!(await consumePublicRateLimit(request, "create_reservation", 5, 1800))) {
      return NextResponse.json(
        { error: "Foram feitas demasiadas tentativas. Aguarde alguns minutos." },
        { status: 429 },
      );
    }

    const parsed = reservationSchema.safeParse(await request.json());
    if (!parsed.success || parsed.data.website) {
      return NextResponse.json({ error: "Revise os dados da reserva." }, { status: 400 });
    }
    const args = {
      requested_restaurant_id: parsed.data.requested_restaurant_id,
      requested_customer_name: parsed.data.requested_customer_name,
      requested_customer_phone: parsed.data.requested_customer_phone,
      requested_customer_email: parsed.data.requested_customer_email,
      requested_date: parsed.data.requested_date,
      requested_time: parsed.data.requested_time,
      requested_party_size: parsed.data.requested_party_size,
      requested_special_requests: parsed.data.requested_special_requests,
    };
    const { data, error } = await createAdminClient().rpc("create_public_reservation", args);
    if (error || !data?.[0]) {
      return NextResponse.json({ error: error?.message ?? "Não foi possível criar a reserva." }, { status: 400 });
    }
    return NextResponse.json(data[0], { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível criar a reserva." },
      { status: 500 },
    );
  }
}
