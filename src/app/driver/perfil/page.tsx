import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentDriver } from "@/lib/drivers/get-current-driver";

export default async function DriverProfilePage() {
  const { user, driver } = await getCurrentDriver();

  if (!driver) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Perfil</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Dados da conta do estafeta.
        </p>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Conta</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-zinc-500">E-mail</p>
            <p className="font-medium">{user.email}</p>
          </div>

          <div>
            <p className="text-zinc-500">Estado</p>
            <p className="font-medium">{driver.status}</p>
          </div>

          <div>
            <p className="text-zinc-500">Veículo</p>
            <p className="font-medium">
              {driver.vehicle_type ?? "Não informado"}
            </p>
          </div>

          <div>
            <p className="text-zinc-500">Matrícula</p>
            <p className="font-medium">
              {driver.vehicle_plate ?? "Não informada"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
