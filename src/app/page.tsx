import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Bike,
  CalendarDays,
  Check,
  ChefHat,
  CreditCard,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAuthDestination } from "@/lib/auth/get-auth-destination";
import { formatMoneyFromCents } from "@/lib/platform/format";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(await getAuthDestination(supabase, user.id));

  const { data: plans } = await supabase
    .from("subscription_plans")
    .select(
      "id, name, description, monthly_price_cents, currency_code, features",
    )
    .eq("is_active", true)
    .eq("is_public", true)
    .order("sort_order");

  const features = [
    {
      title: "Pedidos em tempo real",
      description:
        "Alerta contínuo, aceitação, cozinha e estado para o cliente.",
      icon: ShoppingBag,
    },
    {
      title: "Cozinha organizada",
      description: "Fila operacional clara desde o pedido até ficar pronto.",
      icon: ChefHat,
    },
    {
      title: "Reservas completas",
      description: "Agenda, capacidade, confirmação e histórico de clientes.",
      icon: CalendarDays,
    },
    {
      title: "Entregas flexíveis",
      description: "Estafetas privados, convidados ou rede partilhada.",
      icon: Bike,
    },
    {
      title: "Pagamentos seguros",
      description: "MB WAY pela Stripe, terminal e dinheiro com troco.",
      icon: CreditCard,
    },
    {
      title: "Decisões com dados",
      description: "Vendas, ticket médio, horários e desempenho num painel.",
      icon: BarChart3,
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <MarketingHeader />
      <main>
        <section className="relative overflow-hidden bg-zinc-950 text-white">
          <div className="absolute left-1/2 top-0 size-[700px] -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-28">
            <div className="self-center">
              <Badge className="bg-amber-400 text-zinc-950">
                <Sparkles className="size-3.5" />
                30 dias para testar
              </Badge>
              <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
                O restaurante inteiro, a funcionar num só lugar.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
                Pedidos, reservas, pagamentos, cozinha, clientes e estafetas num
                sistema criado para a operação real — com a identidade do seu
                restaurante.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  render={<Link href="/register" />}
                  nativeButton={false}
                  size="lg"
                  className="h-11 gap-2 bg-amber-400 px-5 text-zinc-950 hover:bg-amber-300"
                >
                  Criar o meu restaurante <ArrowRight className="size-4" />
                </Button>
                <Button
                  render={<Link href="/r/hirotatsu-sushi" />}
                  nativeButton={false}
                  size="lg"
                  variant="outline"
                  className="h-11 border-white/15 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white"
                >
                  Ver exemplo real
                </Button>
              </div>
              <p className="mt-4 text-xs text-zinc-500">
                Sem compromisso durante o período de teste. Configuração guiada.
              </p>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-amber-950/30">
              <div className="rounded-3xl bg-white p-5 text-zinc-950">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-amber-600">HOJE</p>
                    <p className="mt-1 text-xl font-semibold">
                      Operação em movimento
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                    ● Restaurante aberto
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-zinc-950 p-4 text-white">
                    <p className="text-xs text-zinc-400">Vendas</p>
                    <p className="mt-2 text-2xl font-semibold">€ 1.284</p>
                    <p className="mt-2 text-xs text-emerald-400">
                      +18,4% esta semana
                    </p>
                  </div>
                  <div className="rounded-2xl bg-amber-100 p-4">
                    <p className="text-xs text-amber-800">Pedidos ativos</p>
                    <p className="mt-2 text-2xl font-semibold">12</p>
                    <p className="mt-2 text-xs text-amber-700">3 novos agora</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    "#A19C2F · Preparando",
                    "#D32B10 · Aguardando estafeta",
                    "#B921EF · Pronto",
                  ].map((item, index) => (
                    <div
                      key={item}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 text-sm"
                    >
                      <span className="font-medium">{item}</span>
                      <span
                        className={`size-2 rounded-full ${index === 2 ? "bg-emerald-500" : index === 1 ? "bg-violet-500" : "bg-amber-500"}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="produto" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-amber-600">Tudo conectado</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight">
              Menos ferramentas. Mais controlo.
            </h2>
            <p className="mt-4 leading-7 text-zinc-500">
              Cada módulo partilha a mesma informação, evitando tarefas
              duplicadas e falhas entre sala, cozinha e entrega.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.title}
                  className="border-zinc-200 shadow-none"
                >
                  <CardContent className="p-5">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-zinc-950 text-amber-400">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="border-y border-zinc-200 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-medium text-amber-600">
                  Planos transparentes
                </p>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight">
                  Comece com o tamanho certo.
                </h2>
              </div>
              <Button
                render={<Link href="/pricing" />}
                nativeButton={false}
                variant="outline"
                className="gap-2"
              >
                Comparar planos <ArrowRight className="size-4" />
              </Button>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {(plans ?? []).map((plan, index) => {
                const items = Array.isArray(plan.features)
                  ? plan.features.filter(
                      (item): item is string => typeof item === "string",
                    )
                  : [];
                return (
                  <Card
                    key={plan.id}
                    className={`border-zinc-200 shadow-none ${index === 1 ? "ring-2 ring-amber-400" : ""}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-semibold">{plan.name}</h3>
                        {index === 1 ? (
                          <Badge className="bg-amber-100 text-amber-800">
                            Mais escolhido
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-zinc-500">
                        {plan.description}
                      </p>
                      <p className="mt-6 text-4xl font-semibold">
                        {formatMoneyFromCents(
                          plan.monthly_price_cents,
                          plan.currency_code,
                        )}
                        <span className="text-sm font-normal text-zinc-400">
                          /mês
                        </span>
                      </p>
                      <ul className="mt-6 space-y-3">
                        {items.slice(0, 5).map((item) => (
                          <li
                            key={item}
                            className="flex gap-2 text-sm text-zinc-600"
                          >
                            <Check className="size-4 shrink-0 text-emerald-600" />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <Button
                        render={<Link href="/register" />}
                        nativeButton={false}
                        className="mt-7 w-full"
                      >
                        Testar 30 dias
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="overflow-hidden rounded-[2rem] bg-amber-400 p-8 sm:p-12">
            <h2 className="max-w-3xl text-4xl font-semibold tracking-tight">
              Pronto para transformar a operação do seu restaurante?
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-amber-950/70">
              Crie a conta agora ou fale connosco para uma demonstração
              acompanhada.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                render={<Link href="/register" />}
                nativeButton={false}
                className="bg-zinc-950 text-white hover:bg-zinc-800"
              >
                Começar agora
              </Button>
              <Button
                render={<Link href="/contact" />}
                nativeButton={false}
                variant="outline"
                className="border-amber-900/20 bg-white/40"
              >
                Pedir demonstração
              </Button>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
