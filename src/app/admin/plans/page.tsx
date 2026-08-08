import { Check, CloudUpload, Plus, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  saveSubscriptionPlanAction,
  syncSubscriptionPlanWithStripeAction,
} from "@/features/platform/actions/platform-actions";
import { requireSuperAdmin } from "@/lib/platform/admin";
import { formatMoneyFromCents } from "@/lib/platform/format";

function featuresAsText(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .join("\n")
    : "";
}

export default async function AdminPlansPage() {
  const { supabase } = await requireSuperAdmin();
  const { data: plans, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .order("sort_order");
  if (error) throw new Error(error.message);

  return (
    <div className="space-y-7 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-sm font-medium text-amber-600">Receita recorrente</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Planos e preços
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Edite a oferta e sincronize os produtos de assinatura com a Stripe.
        </p>
      </header>

      <div className="grid gap-5 xl:grid-cols-3">
        {(plans ?? []).map((plan) => (
          <Card key={plan.id} className="border-zinc-200 shadow-none">
            <CardHeader className="border-b border-zinc-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <p className="mt-1 text-sm text-zinc-500">
                    {formatMoneyFromCents(plan.monthly_price_cents)}/mês
                  </p>
                </div>
                <Badge
                  variant={plan.stripe_monthly_price_id ? "default" : "outline"}
                >
                  {plan.stripe_monthly_price_id
                    ? "Stripe pronta"
                    : "Por sincronizar"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              <form action={saveSubscriptionPlanAction} className="space-y-4">
                <input type="hidden" name="id" value={plan.id} />
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium">Nome</span>
                    <Input name="name" defaultValue={plan.name} required />
                  </label>
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium">Código</span>
                    <Input name="code" defaultValue={plan.code} required />
                  </label>
                </div>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Descrição</span>
                  <Textarea
                    name="description"
                    defaultValue={plan.description ?? ""}
                    rows={3}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium">Mensal (€)</span>
                    <Input
                      name="monthlyPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={(plan.monthly_price_cents / 100).toFixed(2)}
                      required
                    />
                  </label>
                  <label className="space-y-1.5 text-sm">
                    <span className="font-medium">Anual (€)</span>
                    <Input
                      name="yearlyPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={
                        plan.yearly_price_cents
                          ? (plan.yearly_price_cents / 100).toFixed(2)
                          : ""
                      }
                    />
                  </label>
                </div>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Benefícios (um por linha)</span>
                  <Textarea
                    name="features"
                    defaultValue={featuresAsText(plan.features)}
                    rows={6}
                  />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={plan.is_active}
                    />
                    Ativo
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="isPublic"
                      defaultChecked={plan.is_public}
                    />
                    Público
                  </label>
                  <label className="space-y-1 text-xs">
                    <span>Ordem</span>
                    <Input
                      name="sortOrder"
                      type="number"
                      defaultValue={plan.sort_order}
                    />
                  </label>
                </div>
                <Button type="submit" className="w-full gap-2">
                  <Save className="size-4" />
                  Guardar plano
                </Button>
              </form>
              <form action={syncSubscriptionPlanWithStripeAction}>
                <input type="hidden" name="planId" value={plan.id} />
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full gap-2"
                >
                  <CloudUpload className="size-4" />
                  Sincronizar com Stripe
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}

        <Card className="border-dashed border-zinc-300 bg-transparent shadow-none">
          <CardHeader>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-zinc-950 text-white">
              <Plus className="size-5" />
            </div>
            <CardTitle className="mt-3">Novo plano</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveSubscriptionPlanAction} className="space-y-4">
              <Input name="name" placeholder="Nome do plano" required />
              <Input name="code" placeholder="codigo-do-plano" />
              <Textarea
                name="description"
                placeholder="Descrição comercial"
                rows={3}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  name="monthlyPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Mensal €"
                  required
                />
                <Input
                  name="yearlyPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Anual €"
                />
              </div>
              <Textarea
                name="features"
                placeholder={"Benefício 1\nBenefício 2"}
                rows={5}
              />
              <div className="flex gap-5 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="isActive" defaultChecked />
                  Ativo
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="isPublic" defaultChecked />
                  Público
                </label>
              </div>
              <input type="hidden" name="sortOrder" value="100" />
              <Button type="submit" className="w-full gap-2">
                <Check className="size-4" />
                Criar plano
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
