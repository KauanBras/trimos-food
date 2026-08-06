import {
  activateDriverModeAction,
} from "@/features/drivers/actions/driver-actions";
import { DriverDashboardClient } from "@/features/drivers/components/driver-dashboard-client";
import { DriverPushSetup } from "@/features/notifications/components/driver-push-setup";
import { Button } from "@/components/ui/button";
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
          <CardTitle>Ativar modo estafeta</CardTitle>
          <CardDescription>
            Ative o perfil para testar o fluxo das entregas.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {params.error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {params.error}
            </div>
          )}

          <form action={activateDriverModeAction}>
            <Button
              type="submit"
              className="h-11 w-full bg-zinc-950 hover:bg-zinc-800"
            >
              Ativar perfil de estafeta
            </Button>
          </form>
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

  const effectiveStatus =
    driver.status === "offline" ? "available" : driver.status;

  if (driver.status === "offline") {
    const { error: availabilityError } = await supabase
      .from("drivers")
      .update({ status: "available" })
      .eq("id", driver.id);

    if (availabilityError) {
      throw new Error(
        `Não foi possível ativar o estafeta: ${availabilityError.message}`
      );
    }
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
      distance_km,
      created_at,
      orders (
        customer_name,
        customer_phone,
        total
      )
    `)
    .eq("restaurant_id", restaurantId)
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
        restaurantId={restaurantId}
      initialStatus={effectiveStatus}
      initialDeliveries={deliveries ?? []}
        initialRejectedDeliveryIds={
          rejections?.map((item) => item.delivery_id) ?? []
        }
      />
    </div>
  );
}
