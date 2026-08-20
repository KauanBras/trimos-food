import { Link2, ListPlus, Mail, Plus, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createRestaurantFromAdminAction } from "@/features/platform/actions/platform-actions";

type PlanOption = {
  id: string;
  name: string;
};

export function CreateRestaurantForm({
  activePlans,
}: {
  activePlans: PlanOption[];
}) {
  return (
    <Card
      id="novo-restaurante"
      className="scroll-mt-24 border-amber-200 bg-amber-50/40 shadow-none"
    >
      <CardHeader className="border-b border-amber-100">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-zinc-950">
            <Plus className="size-5" />
          </div>
          <div>
            <CardTitle className="text-lg">
              Cadastrar novo restaurante
            </CardTitle>
            <p className="mt-1 text-sm text-zinc-600">
              Crie o espaço do restaurante e envie o acesso ao proprietário.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div className="mb-5 grid gap-3 rounded-xl border border-amber-100 bg-white/70 p-4 text-sm text-zinc-600 md:grid-cols-3">
          <div className="flex gap-3">
            <Store className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <p>
              <strong className="block text-zinc-900">1. Crie o espaço</strong>
              O restaurante e o acesso do proprietário são criados aqui.
            </p>
          </div>
          <div className="flex gap-3">
            <ListPlus className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <p>
              <strong className="block text-zinc-900">2. Cadastre o menu</strong>
              Depois, entre nesse restaurante e abra Produtos para adicionar
              categorias, pratos, preços, fotos e complementos.
            </p>
          </div>
          <div className="flex gap-3">
            <Link2 className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <p>
              <strong className="block text-zinc-900">3. Partilhe o link</strong>
              Os produtos publicados aparecem automaticamente no menu dos clientes.
            </p>
          </div>
        </div>

        <form action={createRestaurantFromAdminAction} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Nome do restaurante</span>
              <input
                name="name"
                required
                placeholder="Ex.: Casa da Brasa"
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-amber-500"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Link público do menu (opcional)</span>
              <input
                name="slug"
                placeholder="casa-da-brasa"
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-amber-500"
              />
              <span className="block text-xs leading-relaxed text-zinc-500">
                Pode deixar vazio. Ex.: Casa da Brasa gera
                <strong className="ml-1 text-zinc-700">
                  trimos-food.vercel.app/r/casa-da-brasa
                </strong>
                .
              </span>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Nome do proprietário</span>
              <input
                name="ownerName"
                placeholder="Nome completo"
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-amber-500"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">E-mail do proprietário</span>
              <input
                type="email"
                name="ownerEmail"
                required
                placeholder="proprietario@restaurante.pt"
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-amber-500"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Plano</span>
              <select
                name="planId"
                required
                defaultValue=""
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3"
              >
                <option value="" disabled>
                  Selecione o plano
                </option>
                {activePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Estado inicial</span>
              <select
                name="status"
                defaultValue="draft"
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3"
              >
                <option value="draft">Rascunho</option>
                <option value="active">Ativo</option>
                <option value="suspended">Suspenso</option>
                <option value="inactive">Inativo</option>
              </select>
            </label>
            <div className="space-y-1.5 text-sm md:col-span-2">
              <span className="font-medium">Canais disponíveis</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3">
                  <input
                    type="checkbox"
                    name="acceptsDelivery"
                    defaultChecked
                  />
                  Entrega
                </label>
                <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3">
                  <input type="checkbox" name="acceptsPickup" defaultChecked />
                  Levantamento
                </label>
                <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3">
                  <input type="checkbox" name="acceptsDineIn" />
                  No local
                </label>
                <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3">
                  <input type="checkbox" name="acceptsReservations" />
                  Reservas
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm">
                <input type="checkbox" name="billingExempt" />
                Piloto sem cobrança
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm">
                <input type="checkbox" name="isDemo" />
                Ambiente de demonstração
              </label>
            </div>
            <Button type="submit" className="gap-2">
              <Mail className="size-4" />
              Criar e enviar convite
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
