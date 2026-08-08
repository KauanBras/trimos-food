import { notFound } from "next/navigation";

import { PublicOrderStatus, type PublicOrderSummary } from "@/features/cart/components/public-order-status";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export default async function PublicOrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; orderId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ slug, orderId }, { token }] = await Promise.all([params, searchParams]);
  if (!token) notFound();

  const supabase = await createClient();
  const [{ data, error }, { data: restaurant }] = await Promise.all([
    supabase.rpc("get_public_order_status", {
      requested_order_id: orderId,
      requested_order_token: token,
    }),
    supabase.from("restaurants").select("currency_code").eq("slug", slug).eq("status", "active").maybeSingle(),
  ]);

  if (error || !data || !restaurant) notFound();

  return (
    <PublicOrderStatus
      initialOrder={data as Json as PublicOrderSummary}
      token={token}
      slug={slug}
      currencyCode={restaurant.currency_code}
    />
  );
}
