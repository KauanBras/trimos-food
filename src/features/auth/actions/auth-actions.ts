"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function getRequiredField(formData: FormData, field: string) {
  const value = formData.get(field);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`O campo ${field} é obrigatório.`);
  }

  return value.trim();
}

export async function loginAction(formData: FormData) {
  const email = getRequiredField(formData, "email").toLowerCase();
  const password = getRequiredField(formData, "password");

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/restaurant/dashboard");
}

export async function registerAction(formData: FormData) {
  const fullName = getRequiredField(formData, "fullName");
  const email = getRequiredField(formData, "email").toLowerCase();
  const password = getRequiredField(formData, "password");
  const confirmPassword = getRequiredField(formData, "confirmPassword");

  if (password.length < 8) {
    redirect(
      `/register?error=${encodeURIComponent(
        "A palavra-passe deve ter pelo menos 8 caracteres."
      )}`
    );
  }

  if (password !== confirmPassword) {
    redirect(
      `/register?error=${encodeURIComponent(
        "As palavras-passe não coincidem."
      )}`
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");

  if (data.session) {
    redirect("/restaurant/dashboard");
  }

  redirect(
    `/login?success=${encodeURIComponent(
      "Conta criada. Verifique o seu e-mail antes de iniciar sessão."
    )}`
  );
}

export async function logoutAction() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}
