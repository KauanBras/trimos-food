"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bike,
  CalendarDays,
  ChefHat,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  Package,
  Settings,
  Sparkles,
  Store,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navigation = [
  {
    label: "Dashboard",
    href: "/restaurant/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Pedidos",
    href: "/restaurant/orders",
    icon: ClipboardList,
    badge: "4",
  },
  {
    label: "Cozinha",
    href: "/restaurant/kitchen",
    icon: ChefHat,
  },
  {
    label: "Reservas",
    href: "/restaurant/reservations",
    icon: CalendarDays,
  },
  {
    label: "Produtos",
    href: "/restaurant/products",
    icon: Package,
  },
  {
    label: "Clientes",
    href: "/restaurant/customers",
    icon: Users,
  },
  {
    label: "Estafetas",
    href: "/restaurant/drivers",
    icon: Bike,
  },
  {
    label: "Relatórios",
    href: "/restaurant/reports",
    icon: BarChart3,
  },
];

export function RestaurantSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-[280px] shrink-0 border-r border-zinc-200 bg-white lg:flex lg:flex-col">
      <div className="border-b border-zinc-200 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-2xl p-2 text-left outline-none transition hover:bg-zinc-100">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-sm">
              <Store className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-950">
                Hirotatsu Sushi
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-zinc-500">Restaurante aberto</span>
              </div>
            </div>

            <ChevronDown className="size-4 text-zinc-400" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Restaurante atual</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Hirotatsu Sushi</DropdownMenuItem>
            <DropdownMenuItem>Adicionar restaurante</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="px-5 pb-2 pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          Operação
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/restaurant/dashboard" &&
              pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-zinc-950 text-white shadow-sm"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
              }`}
            >
              <Icon
                className={`size-[18px] ${
                  active
                    ? "text-white"
                    : "text-zinc-400 group-hover:text-zinc-700"
                }`}
              />

              <span className="flex-1">{item.label}</span>

              {item.badge && (
                <Badge
                  className={
                    active
                      ? "border-0 bg-white text-zinc-950"
                      : "border-0 bg-zinc-200 text-zinc-700"
                  }
                >
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 text-amber-900">
          <Sparkles className="size-4" />
          <p className="text-sm font-semibold">Plano Pro</p>
        </div>
        <p className="mt-2 text-xs leading-5 text-amber-800/70">
          Pedidos, reservas e estafetas sem limites.
        </p>
      </div>

      <div className="border-t border-zinc-200 p-3">
        <Link
          href="/restaurant/settings"
          className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
        >
          <Settings className="size-[18px] text-zinc-400" />
          Configurações
        </Link>

        <div className="flex items-center gap-3 rounded-2xl bg-zinc-100 p-3">
          <Avatar className="size-10 border border-white">
            <AvatarFallback className="bg-zinc-950 text-xs text-white">
              KB
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-950">
              Kauan Brandão
            </p>
            <p className="truncate text-xs text-zinc-500">Proprietário</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
