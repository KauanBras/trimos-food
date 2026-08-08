import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentDriver } from "@/lib/drivers/get-current-driver";
import { createClient } from "@/lib/supabase/server";

export default async function DriverHistoryPage() {
  const { driver } = await getCurrentDriver();

  if (!driver) {
    return null;
  }

  const supabase = await createClient();
  const { data: earnings, error } = await supabase
    .from("driver_earnings")
    .select(`
      id,
      order_id,
      driver_fee,
      cash_collected,
      net_balance,
      status,
      created_at,
      settled_at,
      orders (
        customer_name,
        total
      ),
      restaurants (
        name,
        currency_code
      )
    `)
    .eq("driver_id", driver.id)
    .order("created_at", { ascending: false });

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

      {earnings?.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="shadow-none"><CardContent className="p-5"><p className="text-sm text-zinc-500">Ganhos acumulados</p><p className="mt-2 text-2xl font-semibold">{new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(earnings.reduce((sum, item) => sum + Number(item.driver_fee), 0))}</p></CardContent></Card>
          <Card className="border-emerald-200 bg-emerald-50/50 shadow-none"><CardContent className="p-5"><p className="text-sm text-emerald-700">A receber</p><p className="mt-2 text-2xl font-semibold text-emerald-800">{new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(earnings.filter((item) => item.status === "pending").reduce((sum, item) => sum + Math.max(0, Number(item.net_balance)), 0))}</p></CardContent></Card>
          <Card className="border-amber-200 bg-amber-50/50 shadow-none"><CardContent className="p-5"><p className="text-sm text-amber-700">Dinheiro a entregar</p><p className="mt-2 text-2xl font-semibold text-amber-800">{new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(earnings.filter((item) => item.status === "pending").reduce((sum, item) => sum + Math.max(0, -Number(item.net_balance)), 0))}</p></CardContent></Card>
        </div>
      ) : null}

      {!earnings?.length ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex min-h-56 items-center justify-center text-zinc-500">
            Ainda não existem entregas concluídas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {earnings.map((earning) => {
            const order = earning.orders;
            const currencyCode = earning.restaurants?.currency_code ?? "EUR";

            return (
              <Card key={earning.id} className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {earning.restaurants?.name ?? "Restaurante"} · {order?.customer_name ?? "Cliente"}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-1 text-sm text-zinc-600">
                  <p>
                    Pedido #{earning.order_id.slice(0, 6).toUpperCase()}
                  </p>
                  <p>
                    Total:{" "}
                    {new Intl.NumberFormat("pt-PT", {
                      style: "currency",
                      currency: currencyCode,
                    }).format(order?.total ?? 0)}
                  </p>
                  <p>
                    O seu ganho:{" "}
                    {new Intl.NumberFormat("pt-PT", {
                      style: "currency",
                      currency: currencyCode,
                    }).format(earning.driver_fee)}
                  </p>
                  {Number(earning.cash_collected) > 0 ? <p>Dinheiro recebido do cliente: {new Intl.NumberFormat("pt-PT", { style: "currency", currency: currencyCode }).format(earning.cash_collected)}</p> : null}
                  <p className={earning.status === "settled" ? "text-emerald-700" : "text-amber-700"}>{earning.status === "settled" ? "Acerto liquidado" : Number(earning.net_balance) >= 0 ? `Restaurante deve: ${new Intl.NumberFormat("pt-PT", { style: "currency", currency: currencyCode }).format(earning.net_balance)}` : `A entregar ao restaurante: ${new Intl.NumberFormat("pt-PT", { style: "currency", currency: currencyCode }).format(Math.abs(earning.net_balance))}`}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
