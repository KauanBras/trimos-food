"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthDestination } from "@/lib/auth/get-auth-destination";
import { createClient } from "@/lib/supabase/server";

function getRequiredField(formData: FormData, field: string) {
  const value = formData.get(field);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`O campo ${field} é obrigatório.`);
  }

  return value.trim();
}

function getDriverInvite(formData: FormData) {
  const accountType = formData.get("accountType");
  const invite = formData.get("invite");

  return accountType === "driver" &&
    typeof invite === "string" && invite.trim()
    ? invite.trim()
    : null;
}

function withDriverInvite(pathname: string, invite: string | null) {
  if (!invite) return pathname;

  const separator = pathname.includes("?") ? "&" : "?";
  return `${pathname}${separator}accountType=driver&invite=${encodeURIComponent(invite)}`;
}

async function getRequestOrigin() {
  const requestHeaders = await headers();

  const forwardedHost =
    requestHeaders.get("x-forwarded-host");

  const host =
    forwardedHost ?? requestHeaders.get("host");

  const forwardedProto =
    requestHeaders.get("x-forwarded-proto");

  const protocol =
    forwardedProto ??
    (host?.includes("localhost") ||
    host?.startsWith("192.168.") ||
    host?.startsWith("10.")
      ? "http"
      : "https");

  if (host) {
    return `${protocol}://${host}`;
  }

  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  );
}

export async function loginAction(formData: FormData) {
  const invite = getDriverInvite(formData);
  const email = getRequiredField(
    formData,
    "email"
  ).toLowerCase();

  const password = getRequiredField(
    formData,
    "password"
  );

  const supabase = await createClient();

  const {
    data,
    error,
  } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    redirect(
      withDriverInvite(`/login?error=${encodeURIComponent(
        error?.message ??
          "Não foi possível iniciar sessão."
      )}`, invite)
    );
  }

  if (invite) {
    const { error: inviteError } = await supabase.rpc(
      "accept_driver_invite",
      { requested_token: invite }
    );

    if (inviteError) {
      redirect(
        withDriverInvite(
          `/login?error=${encodeURIComponent(inviteError.message)}`,
          invite
        )
      );
    }

    revalidatePath("/", "layout");
    redirect("/driver/dashboard");
  }

  let destination: string;

  try {
    destination = await getAuthDestination(
      supabase,
      data.user.id
    );
  } catch (destinationError) {
    redirect(
      `/login?error=${encodeURIComponent(
        destinationError instanceof Error
          ? destinationError.message
          : "Não foi possível determinar o painel."
      )}`
    );
  }

  revalidatePath("/", "layout");
  redirect(destination);
}

export async function registerAction(
  formData: FormData
) {
  const fullName = getRequiredField(
    formData,
    "fullName"
  );

  const email = getRequiredField(
    formData,
    "email"
  ).toLowerCase();

  const password = getRequiredField(
    formData,
    "password"
  );

  const confirmPassword = getRequiredField(
    formData,
    "confirmPassword"
  );

  const invite = getDriverInvite(formData);

  if (password.length < 8) {
    redirect(
      withDriverInvite(`/register?error=${encodeURIComponent(
        "A palavra-passe deve ter pelo menos 8 caracteres."
      )}`, invite)
    );
  }

  if (password !== confirmPassword) {
    redirect(
      withDriverInvite(`/register?error=${encodeURIComponent(
        "As palavras-passe não coincidem."
      )}`, invite)
    );
  }

  const origin = await getRequestOrigin();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: invite
        ? `${origin}/auth/callback?invite=${encodeURIComponent(invite)}`
        : `${origin}/auth/callback`,
      data: {
        full_name: fullName,
        account_type: invite ? "driver" : "restaurant_owner",
        driver_invite: invite,
      },
    },
  });

  if (error) {
    redirect(
      withDriverInvite(`/register?error=${encodeURIComponent(
        error.message
      )}`, invite)
    );
  }

  revalidatePath("/", "layout");

  if (data.session && data.user) {
    if (invite) {
      const { error: inviteError } = await supabase.rpc(
        "accept_driver_invite",
        { requested_token: invite }
      );

      if (inviteError) {
        redirect(
          withDriverInvite(
            `/login?error=${encodeURIComponent(inviteError.message)}`,
            invite
          )
        );
      }

      redirect("/driver/dashboard");
    }

    let destination: string;

    try {
      destination = await getAuthDestination(
        supabase,
        data.user.id
      );
    } catch (destinationError) {
      redirect(
        `/login?error=${encodeURIComponent(
          destinationError instanceof Error
            ? destinationError.message
            : "Não foi possível determinar o painel."
        )}`
      );
    }

    redirect(destination);
  }

  redirect(
    withDriverInvite(`/login?success=${encodeURIComponent(
      "Conta criada. Verifique o seu e-mail antes de iniciar sessão."
    )}`, invite)
  );
}

export async function logoutAction() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}
