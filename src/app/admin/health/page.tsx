import {
  CheckCircle2,
  CircleAlert,
  Database,
  KeyRound,
  Radio,
  Webhook,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { requireSuperAdmin } from "@/lib/platform/admin";

export const dynamic = "force-dynamic";

export default async function AdminHealthPage() {
  const { supabase } = await requireSuperAdmin();
  const { error } = await supabase.from("restaurants").select("id").limit(1);
  const checks = [
    {
      label: "Base de dados",
      detail: error ? "Ligação indisponível" : "Ligação confirmada",
      healthy: !error,
      icon: Database,
    },
    {
      label: "Stripe",
      detail: process.env.STRIPE_SECRET_KEY
        ? "Chave configurada"
        : "Falta configurar",
      healthy: Boolean(process.env.STRIPE_SECRET_KEY),
      icon: KeyRound,
    },
    {
      label: "Webhook Stripe",
      detail: process.env.STRIPE_WEBHOOK_SECRET
        ? "Assinatura configurada"
        : "Falta configurar",
      healthy: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      icon: Webhook,
    },
    {
      label: "Supabase administrativo",
      detail: process.env.SUPABASE_SERVICE_ROLE_KEY
        ? "Disponível no servidor"
        : "Falta configurar",
      healthy: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      icon: Radio,
    },
  ];

  return (
    <div className="space-y-7 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-sm font-medium text-amber-600">Operação técnica</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Estado do sistema
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Verificações seguras sem apresentar chaves ou dados confidenciais.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {checks.map((check) => {
          const Icon = check.icon;
          return (
            <Card key={check.label} className="border-zinc-200 shadow-none">
              <CardContent className="flex items-center gap-4 p-5">
                <div
                  className={`rounded-2xl p-3 ${check.healthy ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                >
                  <Icon className="size-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{check.label}</p>
                  <p className="mt-1 text-sm text-zinc-500">{check.detail}</p>
                </div>
                {check.healthy ? (
                  <CheckCircle2 className="size-5 text-emerald-600" />
                ) : (
                  <CircleAlert className="size-5 text-red-600" />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-zinc-400">
        Verificado em{" "}
        {new Intl.DateTimeFormat("pt-PT", {
          dateStyle: "medium",
          timeStyle: "medium",
          timeZone: "Europe/Lisbon",
        }).format(new Date())}
        .
      </p>
    </div>
  );
}
