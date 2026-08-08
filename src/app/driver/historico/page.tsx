import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentDriver } from "@/lib/drivers/get-current-driver";
import { createClient } from "@/lib/supabase/server";

export default async function DriverHistoryPage() {
  const { driver } = await getCurrentDriver();

  if (!driver) {
    return null;
  }

  const supabase = await createClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("currency_code")
    .eq("id", driver.restaurant_id)
    .maybeSingle();
  const currencyCode = restaurant?.currency_code ?? "EUR";

  const { data: deliveries, error } = await supabase
    .from("deliveries")
    .select(`
      id,
      order_id,
      status,
      delivered_at,
      delivery_fee,
      orders (
        customer_name,
        total
      )
    `)
    .eq("driver_id", driver.id)
    .eq("status", "delivered")
    .order("delivered_at", { ascending: false });

  if (error) {
    throw new Error(
      `Não foi possível carregar o histórico: ${error.message}`
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Histórico</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Entregas concluídas por este estafeta.
        </p>
      </div>

      {!deliveries?.length ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex min-h-56 items-center justify-center text-zinc-500">
            Ainda não existem entregas concluídas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {deliveries.map((delivery) => {
            const order = delivery.orders;

            return (
              <Card key={delivery.id} className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {order?.customer_name ?? "Cliente"}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-1 text-sm text-zinc-600">
                  <p>
                    Pedido #{delivery.order_id.slice(0, 6).toUpperCase()}
                  </p>
                  <p>
                    Total:{" "}
                    {new Intl.NumberFormat("pt-PT", {
                      style: "currency",
                      currency: currencyCode,
                    }).format(order?.total ?? 0)}
                  </p>
                  <p>
                    Taxa:{" "}
                    {new Intl.NumberFormat("pt-PT", {
                      style: "currency",
                      currency: currencyCode,
                    }).format(delivery.delivery_fee)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
