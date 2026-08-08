"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ClipboardList,
  CreditCard,
  Handshake,
  LayoutDashboard,
  LogOut,
  Store,
  UtensilsCrossed,
} from "lucide-react";

import { logoutAction } from "@/features/auth/actions/auth-actions";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Visão geral", href: "/admin", icon: LayoutDashboard },
  { label: "Restaurantes", href: "/admin/restaurants", icon: Store },
  { label: "Oportunidades", href: "/admin/leads", icon: Handshake },
  { label: "Planos", href: "/admin/plans", icon: CreditCard },
  { label: "Auditoria", href: "/admin/audit", icon: ClipboardList },
  { label: "Estado do sistema", href: "/admin/health", icon: Activity },
];

export function AdminSidebar({ userName }: { userName: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-[268px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 text-white lg:flex">
      <div className="border-b border-white/10 p-6">
        <Link href="/admin" className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-400 text-zinc-950">
            <UtensilsCrossed className="size-5" />
          </div>
          <div>
            <p className="font-semibold">Trimos Food</p>
            <p className="text-xs text-zinc-500">Administração da plataforma</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-white text-zinc-950"
                  : "text-zinc-400 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="size-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <Link
          href="/restaurant/dashboard"
          className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-white"
        >
          <Store className="size-[18px]" />
          Abrir restaurante piloto
        </Link>
        <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-amber-400 text-xs font-semibold text-zinc-950">
            {userName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="text-xs text-zinc-500">Administrador geral</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Terminar sessão"
              className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
