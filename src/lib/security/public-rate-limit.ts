import "server-only";

import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

function requestIdentity(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  const userAgent = request.headers.get("user-agent")?.slice(0, 240) || "unknown";
  const secret = process.env.PUBLIC_RATE_LIMIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("A proteção contra abuso não está configurada.");
  return createHash("sha256").update(`${secret}:${ip}:${userAgent}`).digest("hex");
}

export async function consumePublicRateLimit(
  request: Request,
  action: string,
  limit: number,
  windowSeconds: number,
) {
  const { data, error } = await createAdminClient().rpc("consume_public_rate_limit", {
    requested_action: action,
    requested_key_hash: requestIdentity(request),
    requested_limit: limit,
    requested_window_seconds: windowSeconds,
  });
  if (error) throw new Error(error.message);
  return data;
}

