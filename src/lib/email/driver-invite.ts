import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

type DriverInviteEmailInput = {
  email: string;
  token: string;
  restaurantName: string;
  expiresAt: string;
  origin: string;
};

export async function sendDriverInviteEmail({
  email,
  token,
  restaurantName,
  expiresAt,
  origin,
}: DriverInviteEmailInput) {
  const redirectTo = `${origin}/driver/activate/${encodeURIComponent(token)}`;
  const metadata = {
    account_type: "driver",
    driver_invite: token,
    restaurant_name: restaurantName,
    invite_expires_at: expiresAt,
  };
  const admin = createAdminClient();
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    { data: metadata, redirectTo },
  );

  if (!inviteError) {
    return { sent: true, method: "invite" as const };
  }

  const alreadyRegistered = /already|registered|exists|existente|regist/i.test(
    inviteError.message,
  );
  if (!alreadyRegistered) {
    throw new Error(inviteError.message);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error("O serviço de e-mail não está configurado.");
  }

  const mailClient = createSupabaseClient(supabaseUrl, anonKey, {
    auth: {
      flowType: "implicit",
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const { error: magicLinkError } = await mailClient.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectTo,
      data: metadata,
    },
  });

  if (magicLinkError) {
    throw new Error(magicLinkError.message);
  }

  return { sent: true, method: "magic_link" as const };
}
