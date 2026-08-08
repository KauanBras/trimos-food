import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bike,
  ChevronRight,
  Store,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function SelectRolePage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const [
    { data: driver, error: driverError },
    { data: membership, error: membershipError },
  ] = await Promise.all([
    supabase
      .from("drivers")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),

    supabase
      .from("restaurant_users")
      .select("restaurant_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (driverError) {
    throw new Error(
      `Não foi possível verificar o perfil de estafeta: ${driverError.message}`
    );
  }

  if (membershipError) {
    throw new Error(
      `Não foi possível verificar o restaurante: ${membershipError.message}`
    );
  }

  if (membership && !driver) {
    redirect("/restaurant/dashboard");
  }

  if (driver && !membership) {
    redirect("/driver/dashboard");
  }

  if (!driver && !membership) {
    redirect("/onboarding");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-5">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium text-amber-600">
            Trimos Food
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            Como pretende entrar?
          </h1>

          <p className="mt-2 text-zinc-500">
            Esta conta possui mais de um perfil ativo.
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/restaurant/dashboard"
            className="block"
          >
            <Card className="group border-zinc-200 bg-white shadow-sm transition hover:border-zinc-400 hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                  <Store className="size-6" />
                </div>

                <div className="min-w-0 flex-1">
                  <CardTitle className="text-xl">
                    Restaurante
                  </CardTitle>

                  <CardDescription className="mt-1">
                    Pedidos, cozinha, produtos, reservas e gestão.
                  </CardDescription>
                </div>

                <ChevronRight className="size-5 text-zinc-400 transition group-hover:translate-x-1 group-hover:text-zinc-950" />
              </CardHeader>
            </Card>
          </Link>

          <Link
            href="/driver/dashboard"
            className="block"
          >
            <Card className="group border-zinc-200 bg-white shadow-sm transition hover:border-amber-400 hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-zinc-950">
                  <Bike className="size-6" />
                </div>

                <div className="min-w-0 flex-1">
                  <CardTitle className="text-xl">
                    Estafeta
                  </CardTitle>

                  <CardDescription className="mt-1">
                    Receber ofertas e gerir as suas entregas.
                  </CardDescription>
                </div>

                <ChevronRight className="size-5 text-zinc-400 transition group-hover:translate-x-1 group-hover:text-amber-600" />
              </CardHeader>
            </Card>
          </Link>
        </div>

        <Card className="mt-6 border-dashed bg-transparent shadow-none">
          <CardContent className="p-4 text-center text-sm text-zinc-500">
            Pode alternar entre os dois modos sempre que necessário.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
