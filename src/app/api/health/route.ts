import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase
    .from("public_restaurants")
    .select("id")
    .eq("status", "active")
    .limit(1);

  const healthy = !error;

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      database: healthy ? "connected" : "unavailable",
      checkedAt: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
