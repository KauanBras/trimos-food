import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getAuthDestination } from "@/lib/auth/get-auth-destination";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(await getAuthDestination(supabase, user.id));
  }

  redirect("/login");
}
