import {
  ArrowDownRight,
  ArrowUpRight,
  Bike,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  Clock3,
  Euro,
  MoreHorizontal,
  ShoppingBag,
  Sparkles,
  Timer,
  UtensilsCrossed,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const metrics = [
  {
    title: "Vendas de hoje",
    value: "€ 248,90",
    change: "+12,5%",
    positive: true,
    detail: "comparado com ontem",
    icon: Euro,
  },
  {
    title: "Pedidos",
    value: "18",
    change: "+4",
    positive: true,
    detail: "comparado com ontem",
    icon: ShoppingBag,
  },
  {
    title: "Ticket médio",
    value: "€ 27,65",
    change: "+9,3%",
    positive: true,
    detail: "nos últimos 7 dias",
    icon: Sparkles,
  },
  {
    title: "Tempo médio",
    value: "24 min",
    change: "-3 min",
    positive: true,
    detail: "tempo de preparação",
    icon: Timer,
  },
];

const orders = [
  {
    id: "#1049",
    customer: "Ricardo Mendes",
    initials: "RM",
    type: "Entrega",
    total: "€ 41,20",
    time: "há 1 min",
    status: "Novo pedido",
    statusClass: "bg-red-50 text-red-700 border-red-200",
  },
  {
    id: "#1048",
    customer: "João Silva",
    initials: "JS",
    type: "Entrega",
    total: "€ 34,90",
    time: "há 8 min",
    status: "Em preparação",
    statusClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    id: "#1047",
    customer: "Mariana Costa",
    initials: "MC",
    type: "Recolha",
    total: "€ 26,50",
    time: "há 19 min",
    status: "Pronto",
    statusClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
];

const kitchen = [
  {
    id: "#1048",
    items: "Combo Hiro 44 peças",
    elapsed: "12 min",
    progress: "70%",
  },
  {
    id: "#1045",
    items: "2 Temakis + Hot roll",
    elapsed: "18 min",
    progress: "90%",
  },
  {
    id: "#1044",
    items: "Combo Salmão 32 peças",
    elapsed: "8 min",
    progress: "45%",
  },
];

export default function RestaurantDashboardPage() {
  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl bg-zinc-950 px-6 py-7 text-white shadow-sm lg:px-8">
        <div className="absolute -right-20 -top-24 size-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute bottom-0 right-32 size-40 rounded-full bg-white/5 blur-2xl" />

        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-zinc-400">
              <span className="size-2 rounded-full bg-emerald-400" />
              Operação ativa
            </div>

            <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">
              Boa noite, Kauan.
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
              O Hirotatsu está aberto e a operação está a funcionar normalmente.
              Existem quatro pedidos ativos neste momento.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              Ver reservas
            </Button>

            <Button className="gap-2 bg-amber-400 text-zinc-950 hover:bg-amber-300">
              Abrir modo operação
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const ChangeIcon = metric.positive
            ? ArrowUpRight
            : ArrowDownRight;

          return (
            <Card
              key={metric.title}
              className="border-zinc-200 shadow-none transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-500">
                      {metric.title}
                    </p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
                      {metric.value}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-zinc-100 p-3">
                    <Icon className="size-5 text-zinc-700" />
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 font-semibold text-emerald-600">
                    <ChangeIcon className="size-3.5" />
                    {metric.change}
                  </span>
                  <span className="text-zinc-400">{metric.detail}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="border-zinc-200 shadow-none">
          <CardHeader className="flex flex-row items-start justify-between border-b border-zinc-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
                </span>
                <CardTitle className="text-lg">Pedidos em tempo real</CardTitle>
              </div>

              <p className="mt-1 text-sm text-zinc-500">
                Pedidos mais recentes recebidos pelo restaurante.
              </p>
            </div>

            <Button variant="ghost" size="sm" className="gap-2">
              Ver todos
              <ChevronRight className="size-4" />
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            {orders.map((order, index) => (
              <div key={order.id}>
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <Avatar className="size-11">
                    <AvatarFallback className="bg-zinc-100 text-xs font-semibold text-zinc-700">
                      {order.initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-zinc-950">
                        {order.id} · {order.customer}
                      </p>

                      <Badge
                        variant="outline"
                        className={order.statusClass}
                      >
                        {order.status}
                      </Badge>
                    </div>

                    <p className="mt-1 text-sm text-zinc-500">
                      {order.type} · {order.total} · {order.time}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {index === 0 && (
                      <>
                        <Button variant="outline" size="sm">
                          Recusar
                        </Button>
                        <Button
                          size="sm"
                          className="bg-zinc-950 text-white hover:bg-zinc-800"
                        >
                          Aceitar
                        </Button>
                      </>
                    )}

                    {index !== 0 && (
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {index < orders.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="border-zinc-200 shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Operação agora</CardTitle>
                  <p className="mt-1 text-sm text-zinc-500">
                    Estado atual do restaurante.
                  </p>
                </div>

                <div className="rounded-2xl bg-emerald-50 p-3">
                  <CheckCircle2 className="size-5 text-emerald-600" />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-zinc-100 p-2">
                    <ChefHat className="size-4 text-zinc-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Em preparação</p>
                    <p className="text-xs text-zinc-500">Cozinha ativa</p>
                  </div>
                </div>
                <span className="text-lg font-semibold">4</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-zinc-100 p-2">
                    <Bike className="size-4 text-zinc-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Estafetas online</p>
                    <p className="text-xs text-zinc-500">Disponíveis agora</p>
                  </div>
                </div>
                <span className="text-lg font-semibold">2</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-zinc-100 p-2">
                    <CalendarDays className="size-4 text-zinc-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Reservas hoje</p>
                    <p className="text-xs text-zinc-500">21 pessoas previstas</p>
                  </div>
                </div>
                <span className="text-lg font-semibold">6</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-amber-50 shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-amber-400 p-3 text-zinc-950">
                  <UtensilsCrossed className="size-5" />
                </div>

                <div>
                  <p className="font-semibold text-zinc-950">
                    Próxima reserva
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Ana Carvalho · 20:30
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Mesa para 4 pessoas
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                className="mt-5 w-full border-amber-300 bg-white/70"
              >
                Ver detalhes da reserva
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card className="border-zinc-200 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Cozinha</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Progresso dos pedidos em preparação.
              </p>
            </div>

            <Button variant="outline" size="sm">
              Abrir cozinha
            </Button>
          </CardHeader>

          <CardContent className="space-y-5">
            {kitchen.map((item) => (
              <div key={item.id}>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">
                      {item.id} · {item.items}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                      <Clock3 className="size-3.5" />
                      Em preparação há {item.elapsed}
                    </p>
                  </div>

                  <span className="text-sm font-semibold text-zinc-600">
                    {item.progress}
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: item.progress }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">Desempenho de hoje</CardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              Resumo rápido da operação.
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-zinc-500">Meta diária</span>
                <span className="font-semibold">€248,90 / €400</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full w-[62%] rounded-full bg-zinc-950" />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xl font-semibold">94%</p>
                <p className="mt-1 text-xs text-zinc-500">Aceitação</p>
              </div>

              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xl font-semibold">4.8</p>
                <p className="mt-1 text-xs text-zinc-500">Avaliação</p>
              </div>

              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xl font-semibold">24m</p>
                <p className="mt-1 text-xs text-zinc-500">Preparação</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
