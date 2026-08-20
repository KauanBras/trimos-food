import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CreateRestaurantForm } from "@/features/platform/components/create-restaurant-form";
import { requireSuperAdmin } from "@/lib/platform/admin";

export default async function NewRestaurantPage() {
  const { supabase } = await requireSuperAdmin();
  const { data: activePlans, error } = await supabase
    .from("subscription_plans")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw new Error(error.message);

  return (
    <div className="space-y-7 p-4 sm:p-6 lg:p-8">
      <header className="space-y-4">
        <Button
          render={<Link href="/admin/restaurants" />}
          nativeButton={false}
          variant="ghost"
          className="-ml-3 gap-2"
        >
          <ArrowLeft className="size-4" />
          Voltar aos restaurantes
        </Button>
        <div>
          <p className="text-sm font-medium text-amber-600">
            Administração da plataforma
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Novo restaurante
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Cadastre o restaurante, escolha os serviços e envie o convite ao
            proprietário.
          </p>
        </div>
      </header>

      <CreateRestaurantForm activePlans={activePlans ?? []} />
    </div>
  );
}
