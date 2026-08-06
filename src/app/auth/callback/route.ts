import { NextResponse, type NextRequest } from "next/server";

import { getAuthDestination } from "@/lib/auth/get-auth-destination";
import { createClient } from "@/lib/supabase/server";

function createSafeRedirectUrl(
  request: NextRequest,
  pathname: string
) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  const protocol =
    forwardedProto ??
    (host?.includes("localhost") ||
    host?.startsWith("192.168.") ||
    host?.startsWith("10.")
      ? "http"
      : "https");

  if (host) {
    return new URL(pathname, `${protocol}://${host}`);
  }

  return new URL(pathname, request.url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      createSafeRedirectUrl(
        request,
        "/login?error=Link%20de%20confirmação%20inválido."
      )
    );
  }

  const supabase = await createClient();

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      createSafeRedirectUrl(
        request,
        `/login?error=${encodeURIComponent(
          exchangeError.message
        )}`
      )
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(
      createSafeRedirectUrl(
        request,
        "/login?error=Não%20foi%20possível%20confirmar%20a%20sessão."
      )
    );
  }

  const invite = request.nextUrl.searchParams.get("invite");

  if (invite) {
    const { error: inviteError } = await supabase.rpc(
      "accept_driver_invite",
      {
        requested_token: invite,
      }
    );

    if (inviteError) {
      return NextResponse.redirect(
        createSafeRedirectUrl(
          request,
          `/login?error=${encodeURIComponent(
            inviteError.message
          )}`
        )
      );
    }

    return NextResponse.redirect(
      createSafeRedirectUrl(
        request,
        "/driver/dashboard"
      )
    );
  }

  try {
    const destination = await getAuthDestination(
      supabase,
      user.id
    );

    return NextResponse.redirect(
      createSafeRedirectUrl(request, destination)
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro ao determinar o painel do utilizador.";

    return NextResponse.redirect(
      createSafeRedirectUrl(
        request,
        `/login?error=${encodeURIComponent(message)}`
      )
    );
  }
}
