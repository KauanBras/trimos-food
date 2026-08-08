import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDriverProfileAction } from "@/features/drivers/actions/driver-actions";
import { getCurrentDriver } from "@/lib/drivers/get-current-driver";
import { createClient } from "@/lib/supabase/server";

const statusLabels = {
  offline: "Offline",
  available: "Disponível",
  busy: "Em entrega",
  suspended: "Suspenso",
};

export default async function DriverProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { user, driver } = await getCurrentDriver();
  if (!driver) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Perfil</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Mantenha os seus dados de contacto e veículo atualizados.
        </p>
      </div>

      {params.saved ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Perfil atualizado com sucesso.</div>
      ) : null}
      {params.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{params.error}</div>
      ) : null}

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">Dados do estafeta</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateDriverProfileAction} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input id="fullName" name="fullName" defaultValue={profile?.full_name ?? ""} required minLength={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" name="phone" type="tel" defaultValue={driver.phone ?? profile?.phone ?? ""} required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicleType">Tipo de veículo</Label>
                <Input id="vehicleType" name="vehicleType" placeholder="Mota, bicicleta ou carro" defaultValue={driver.vehicle_type ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehiclePlate">Matrícula</Label>
                <Input id="vehiclePlate" name="vehiclePlate" placeholder="AA-00-AA" defaultValue={driver.vehicle_plate ?? ""} />
              </div>
            </div>

            <div className="rounded-2xl bg-zinc-50 p-4 text-sm">
              <p className="text-zinc-500">Conta</p>
              <p className="mt-1 font-medium">{user.email}</p>
              <p className="mt-3 text-zinc-500">Estado atual</p>
              <p className="mt-1 font-medium">{statusLabels[driver.status]}</p>
            </div>

            <Button type="submit" className="h-11 w-full bg-zinc-950 hover:bg-zinc-800">Guardar perfil</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
