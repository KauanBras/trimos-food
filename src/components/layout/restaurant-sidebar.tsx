"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  ArrowLeftRight,
  BarChart3,
  Bike,
  CalendarDays,
  ChefHat,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Package,
  QrCode,
  Settings,
  Sparkles,
  Store,
  Users,
  WalletCards,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { logoutAction } from "@/features/auth/actions/auth-actions";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Dashboard", href: "/restaurant/dashboard", icon: LayoutDashboard },
  { label: "Pedidos", href: "/restaurant/orders", icon: ClipboardList },
  { label: "Cozinha", href: "/restaurant/kitchen", icon: ChefHat },
  { label: "Reservas", href: "/restaurant/reservations", icon: CalendarDays },
  { label: "Produtos", href: "/restaurant/products", icon: Package },
  { label: "QR Codes", href: "/restaurant/tables", icon: QrCode },
  { label: "Clientes", href: "/restaurant/customers", icon: Users },
  { label: "Estafetas", href: "/restaurant/drivers", icon: Bike },
  { label: "Relatórios", href: "/restaurant/reports", icon: BarChart3 },
];

const roleLabels: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  manager: "Gerente",
  staff: "Colaborador",
  kitchen: "Cozinha",
};

type RestaurantSidebarProps = {
  restaurantName: string;
  restaurantSlug: string;
  restaurantLogoUrl: string | null;
  isOpen: boolean;
  userName: string;
  userAvatarUrl: string | null;
  role: string;
  newOrderCount: number;
  onboardingProgress?: number;
  isPlatformAdmin?: boolean;
  restaurantMembershipCount?: number;
  isDemo?: boolean;
  mobile?: boolean;
};

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function RestaurantSidebar({
  restaurantName,
  restaurantSlug,
  restaurantLogoUrl,
  isOpen,
  userName,
  userAvatarUrl,
  role,
  newOrderCount,
  onboardingProgress = 100,
  isPlatformAdmin = false,
  restaurantMembershipCount = 1,
  isDemo = false,
  mobile = false,
}: RestaurantSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "min-h-screen w-[280px] shrink-0 border-r border-zinc-200 bg-white",
        mobile
          ? "flex h-full min-h-0 w-full flex-col overflow-y-auto overscroll-contain"
          : "hidden lg:flex lg:flex-col",
      )}
    >
      <div className="border-b border-zinc-200 p-4">
        <Link
          href="/restaurant/settings"
          className="flex w-full items-center gap-3 rounded-2xl p-2 text-left outline-none transition hover:bg-zinc-100"
        >
          <Avatar className="size-11 shrink-0 rounded-2xl border border-zinc-200">
            <AvatarImage
              src={restaurantLogoUrl ?? undefined}
              alt={restaurantName}
            />
            <AvatarFallback className="rounded-2xl bg-zinc-950 text-white">
              <Store className="size-5" />
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-950">
              {restaurantName}
            </p>
            {isDemo ? (
              <Badge variant="outline" className="mt-1 border-amber-300 bg-amber-50 text-[10px] text-amber-800">
                Demonstração
              </Badge>
            ) : null}
            <div className="mt-1 flex items-center gap-2">
              <span
                className={cn(
                  "size-2 rounded-full",
                  isOpen ? "bg-emerald-500" : "bg-zinc-400",
                )}
              />
              <span className="text-xs text-zinc-500">
                {isOpen ? "Restaurante aberto" : "Restaurante fechado"}
              </span>
            </div>
          </div>
        </Link>
      </div>

      <div className="px-5 pb-2 pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          Operação
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {onboardingProgress < 100 ? (
          <Link
            href="/restaurant/getting-started"
            className={cn(
              "mb-3 flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition",
              pathname === "/restaurant/getting-started"
                ? "border-amber-400 bg-amber-400 text-zinc-950"
                : "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
            )}
          >
            <BadgeCheck className="size-[18px]" />
            <span className="flex-1">Primeiros passos</span>
            <span className="text-xs">{onboardingProgress}%</span>
          </Link>
        ) : null}
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
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-zinc-950 text-white shadow-sm"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
              )}
            >
              <Icon
                className={cn(
                  "size-[18px]",
                  active
                    ? "text-white"
                    : "text-zinc-400 group-hover:text-zinc-700",
                )}
              />
              <span className="flex-1">{item.label}</span>
              {item.href === "/restaurant/orders" && newOrderCount > 0 ? (
                <Badge
                  className={cn(
                    "min-w-6 border-0",
                    active
                      ? "bg-white text-zinc-950"
                      : "bg-red-100 text-red-700",
                  )}
                >
                  {newOrderCount > 99 ? "99+" : newOrderCount}
                </Badge>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pt-3">
        <Link
          href={`/r/${restaurantSlug}`}
          target="_blank"
          className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-zinc-950"
        >
          <Store className="size-[18px] text-amber-600" />
          <span className="flex-1">Menu dos clientes</span>
          <ExternalLink className="size-4 text-zinc-400" />
        </Link>
      </div>

      <div className="m-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 text-amber-900">
          <Sparkles className="size-4" />
          <p className="text-sm font-semibold">Trimos Food</p>
        </div>
        <p className="mt-2 text-xs leading-5 text-amber-800/70">
          Pedidos, reservas, clientes e estafetas no mesmo painel.
        </p>
      </div>

      <div className="border-t border-zinc-200 p-3">
        {restaurantMembershipCount > 1 ? (
          <Link
            href="/restaurant/switch"
            className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-amber-50 hover:text-zinc-950"
          >
            <ArrowLeftRight className="size-[18px] text-amber-600" />
            Trocar restaurante
          </Link>
        ) : null}
        <Link
          href="/restaurant/billing"
          className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
        >
          <WalletCards className="size-[18px] text-zinc-400" />
          Plano e faturação
        </Link>

        {isPlatformAdmin ? (
          <Link
            href="/admin"
            className="mb-1 flex items-center gap-3 rounded-xl bg-zinc-950 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            <Sparkles className="size-[18px] text-amber-400" />
            Administração Trimos
          </Link>
        ) : null}

        <Link
          href="/restaurant/settings"
          className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
        >
          <Settings className="size-[18px] text-zinc-400" />
          Configurações
        </Link>

        <div className="flex items-center gap-3 rounded-2xl bg-zinc-100 p-3">
          <Avatar className="size-10 border border-white">
            <AvatarImage src={userAvatarUrl ?? undefined} alt={userName} />
            <AvatarFallback className="bg-zinc-950 text-xs text-white">
              {initials(userName) || "U"}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-950">
              {userName}
            </p>
            <p className="truncate text-xs text-zinc-500">
              {roleLabels[role] ?? "Colaborador"}
            </p>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Terminar sessão"
              className="rounded-lg p-2 text-zinc-400 transition hover:bg-white hover:text-zinc-950"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
