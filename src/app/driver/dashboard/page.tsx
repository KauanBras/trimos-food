import { DriverDashboardClient } from "@/features/drivers/components/driver-dashboard-client";
import { DriverPushSetup } from "@/features/notifications/components/driver-push-setup";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentDriver } from "@/lib/drivers/get-current-driver";
import { createClient } from "@/lib/supabase/server";

type DriverDashboardPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function DriverDashboardPage({
  searchParams,
}: DriverDashboardPageProps) {
  const params = await searchParams;
  const { driver } = await getCurrentDriver();

  if (!driver) {
    return (
      <Card className="mt-10 border-zinc-200 shadow-none">
        <CardHeader>
          <CardTitle>Convite necessário</CardTitle>
          <CardDescription>
            O seu perfil ainda não está associado a um restaurante.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {params.error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {params.error}
            </div>
          )}

          <p className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">
            Peça ao restaurante para enviar o link de convite. Abra esse link com esta conta para ativar o acesso às entregas.
          </p>
        </CardContent>
      </Card>
    );
  }

  const restaurantId = driver.restaurant_id;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Sessão do estafeta não encontrada.");
  }

  const { data: deliveries, error } = await supabase
    .from("deliveries")
    .select(`
      id,
      order_id,
      driver_id,
      offered_driver_id,
      status,
      delivery_address,
      delivery_fee,
      driver_fee,
      assignment_source,
      distance_km,
      offer_expires_at,
      created_at,
      orders (
        customer_name,
        customer_phone,
        total,
        payment_method,
        payment_status,
        cash_tendered_amount
      ),
      restaurants (
        name,
        currency_code
      )
    `)
    .in("status", [
      "searching_driver",
      "offered",
      "accepted",
      "picked_up"
    ])
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      `Não foi possível carregar as entregas: ${error.message}`
    );
  }

  const { data: rejections, error: rejectionsError } = await supabase
    .from("delivery_rejections")
    .select("delivery_id")
    .eq("driver_id", driver.id);

  if (rejectionsError) {
    throw new Error(
      `Não foi possível carregar as recusas: ${rejectionsError.message}`
    );
  }

  return (
    <div className="space-y-5">
      <DriverPushSetup
        driverId={driver.id}
        restaurantId={restaurantId}
        userId={user.id}
      />

      <DriverDashboardClient
        driverId={driver.id}
        initialStatus={driver.status}
        initialDeliveries={deliveries ?? []}
        initialRejectedDeliveryIds={
          rejections?.map((item) => item.delivery_id) ?? []
        }
      />
    </div>
  );
}
