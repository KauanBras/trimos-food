import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";

function isSupabaseAuthCookie(name: string) {
  return (
    name.startsWith("sb-") &&
    (
      name.includes("auth-token") ||
      name.includes("code-verifier")
    )
  );
}

function clearInvalidAuthCookies(
  request: NextRequest,
  response: NextResponse,
) {
  const authCookies = request.cookies
    .getAll()
    .filter(({ name }) => isSupabaseAuthCookie(name));

  for (const { name } of authCookies) {
    request.cookies.delete(name);

    response.cookies.set({
      name,
      value: "",
      expires: new Date(0),
      path: "/",
    });
  }
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "As variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY não estão configuradas.",
    );
  }

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(
                name,
                value,
                options,
              );
            },
          );
        },
      },
    },
  );

  try {
    const { error } = await supabase.auth.getClaims();

    if (
      error &&
      (
        error.code === "refresh_token_not_found" ||
        error.message
          ?.toLowerCase()
          .includes("refresh token")
      )
    ) {
      clearInvalidAuthCookies(request, response);

      response = NextResponse.next({
        request,
      });

      const authCookies = request.cookies
        .getAll()
        .filter(({ name }) =>
          isSupabaseAuthCookie(name),
        );

      for (const { name } of authCookies) {
        response.cookies.set({
          name,
          value: "",
          expires: new Date(0),
          path: "/",
        });
      }
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.toLowerCase()
        : "";

    if (
      message.includes("refresh token") ||
      message.includes("refresh_token_not_found")
    ) {
      const cookiesToClear = request.cookies
        .getAll()
        .filter(({ name }) =>
          isSupabaseAuthCookie(name),
        );

      for (const { name } of cookiesToClear) {
        request.cookies.delete(name);
      }

      response = NextResponse.next({
        request,
      });

      for (const { name } of cookiesToClear) {
        response.cookies.set({
          name,
          value: "",
          expires: new Date(0),
          path: "/",
        });
      }

      return response;
    }

    console.error(
      "Erro inesperado ao atualizar sessão Supabase:",
      error,
    );
  }

  return response;
}
