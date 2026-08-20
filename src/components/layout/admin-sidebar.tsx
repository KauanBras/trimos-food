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
  Menu,
  PlusCircle,
  Store,
  UtensilsCrossed,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { logoutAction } from "@/features/auth/actions/auth-actions";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Visão geral", href: "/admin", icon: LayoutDashboard },
  {
    label: "Restaurantes",
    href: "/admin/restaurants",
    icon: Store,
    exact: true,
  },
  {
    label: "Cadastrar restaurante",
    href: "/admin/restaurants/new",
    icon: PlusCircle,
  },
  { label: "Oportunidades", href: "/admin/leads", icon: Handshake },
  { label: "Planos", href: "/admin/plans", icon: CreditCard },
  { label: "Auditoria", href: "/admin/audit", icon: ClipboardList },
  { label: "Estado do sistema", href: "/admin/health", icon: Activity },
];

export function AdminSidebar({
  userName,
  mobile = false,
}: {
  userName: string;
  mobile?: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "w-[268px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 text-white",
        mobile
          ? "flex h-dvh w-full overflow-y-auto"
          : "hidden min-h-screen lg:flex",
      )}
    >
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
            (!item.exact &&
              item.href !== "/admin" &&
              pathname.startsWith(`${item.href}/`));

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

export function AdminMobileHeader({ userName }: { userName: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-zinc-200 bg-white/95 px-4 backdrop-blur lg:hidden">
      <Sheet>
        <SheetTrigger
          className="inline-flex size-10 items-center justify-center rounded-xl border border-zinc-200 bg-white"
          aria-label="Abrir navegação da administração"
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="h-dvh w-[290px] overflow-hidden p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navegação da administração</SheetTitle>
          </SheetHeader>
          <AdminSidebar userName={userName} mobile />
        </SheetContent>
      </Sheet>

      <Link href="/admin" className="font-semibold">
        Administração Trimos
      </Link>

      <Button
        render={<Link href="/admin/restaurants/new" />}
        nativeButton={false}
        size="sm"
        className="ml-auto gap-1.5"
      >
        <PlusCircle className="size-4" />
        <span className="hidden min-[390px]:inline">Novo restaurante</span>
        <span className="min-[390px]:hidden">Novo</span>
      </Button>
    </header>
  );
}
