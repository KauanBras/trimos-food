import Link from "next/link";
import Image from "next/image";
import {
  Bike,
  History,
  Home,
  LogOut,
  PackageCheck,
  UserRound,
} from "lucide-react";

import { logoutAction } from "@/features/auth/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { getCurrentDriver } from "@/lib/drivers/get-current-driver";
import { createClient } from "@/lib/supabase/server";

const navigation = [
  {
    label: "Início",
    href: "/driver/dashboard",
    icon: Home,
  },
  {
    label: "Entregas",
    href: "/driver/entregas",
    icon: PackageCheck,
  },
  {
    label: "Histórico",
    href: "/driver/historico",
    icon: History,
  },
  {
    label: "Perfil",
    href: "/driver/perfil",
    icon: UserRound,
  },
];

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { driver } = await getCurrentDriver();
  const supabase = await createClient();
  const { data: restaurant } = driver
    ? await supabase
        .from("restaurants")
        .select("name, logo_url")
        .eq("id", driver.restaurant_id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="min-h-screen bg-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link
            href="/driver/dashboard"
            className="flex items-center gap-3"
          >
            <div className="relative flex size-10 items-center justify-center overflow-hidden rounded-2xl bg-zinc-950 text-white">
              {restaurant?.logo_url ? (
                <Image src={restaurant.logo_url} alt={restaurant.name} fill className="object-cover" sizes="40px" />
              ) : (
                <Bike className="size-5" />
              )}
            </div>

            <div>
              <p className="font-semibold leading-none">Trimos Driver</p>
              <p className="mt-1 text-xs text-zinc-500">
                {restaurant?.name ?? "Trimos Food"}
              </p>
            </div>
          </Link>

          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="icon">
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-5">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white">
        <div className="mx-auto grid h-20 max-w-3xl grid-cols-4">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={item.href}
                className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-zinc-500 transition hover:text-zinc-950"
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
