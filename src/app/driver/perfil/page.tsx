import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

            <div className="space-y-4 rounded-2xl border border-zinc-200 p-4">
              <label className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Disponível para a rede Trimos</p>
                  <p className="text-sm text-zinc-500">Permite receber ofertas de outros restaurantes próximos com esta mesma conta.</p>
                </div>
                <Switch name="networkEnabled" defaultChecked={driver.is_network_enabled} />
              </label>
              <div className="space-y-2">
                <Label htmlFor="networkRadiusKm">Distância máxima da rede (km)</Label>
                <Input id="networkRadiusKm" name="networkRadiusKm" type="number" min="1" max="100" step="1" defaultValue={driver.network_radius_km} />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-zinc-200 p-4">
              <div>
                <p className="font-medium">Como prefere receber os acertos</p>
                <p className="text-sm text-zinc-500">O sistema calcula os valores; o restaurante regista a liquidação.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payoutMethod">Forma de recebimento</Label>
                <select id="payoutMethod" name="payoutMethod" defaultValue={driver.payout_method} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm">
                  <option value="mb_way">MB WAY</option>
                  <option value="bank_transfer">Transferência bancária</option>
                  <option value="cash">Dinheiro</option>
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="payoutPhone">Telefone MB WAY</Label>
                  <Input id="payoutPhone" name="payoutPhone" type="tel" defaultValue={driver.payout_phone ?? driver.phone ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payoutIban">IBAN</Label>
                  <Input id="payoutIban" name="payoutIban" autoComplete="off" defaultValue={driver.payout_iban ?? ""} />
                </div>
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
