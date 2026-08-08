"use client";

import Link from "next/link";
import { Bell, Menu, Search, Zap } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { RestaurantSidebar } from "@/components/layout/restaurant-sidebar";

type RestaurantTopbarProps = {
  restaurantName: string;
  restaurantLogoUrl: string | null;
  operatingLabel: string;
  isOpen: boolean;
  userName: string;
  userAvatarUrl: string | null;
  role: string;
  newOrderCount: number;
};

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function RestaurantTopbar(props: RestaurantTopbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-[72px] items-center border-b border-zinc-200 bg-white/95 px-4 backdrop-blur lg:px-8">
      <div className="flex w-full items-center gap-4">
        <Sheet>
          <SheetTrigger
            className="inline-flex size-9 items-center justify-center rounded-md border border-zinc-200 bg-white transition-colors hover:bg-zinc-100 lg:hidden"
            aria-label="Abrir navegação"
          >
            <Menu className="size-5" />
          </SheetTrigger>

          <SheetContent side="left" className="w-[290px] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navegação</SheetTitle>
            </SheetHeader>
            <RestaurantSidebar {...props} mobile />
          </SheetContent>
        </Sheet>

        <form action="/restaurant/search" className="relative hidden max-w-md flex-1 md:block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            name="q"
            type="search"
            aria-label="Procurar no restaurante"
            placeholder="Procurar pedidos, clientes ou reservas..."
            className="h-10 border-zinc-200 bg-zinc-50 pl-9 shadow-none"
          />
        </form>

        <div className="ml-auto flex items-center gap-2">
          <Badge
            variant="outline"
            className={`hidden h-9 gap-2 rounded-xl px-3 sm:flex ${
              props.isOpen
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-zinc-200 bg-zinc-100 text-zinc-600"
            }`}
          >
            <span
              className={`size-2 rounded-full ${
                props.isOpen ? "bg-emerald-500" : "bg-zinc-400"
              }`}
            />
            {props.operatingLabel}
          </Badge>

          <Button
            render={<Link href="/restaurant/orders" />}
            variant="outline"
            className="hidden gap-2 rounded-xl sm:flex"
          >
            <Zap className="size-4" />
            Modo operação
          </Button>

          <Button
            render={<Link href="/restaurant/orders" aria-label="Ver novos pedidos" />}
            variant="outline"
            size="icon"
            className="relative rounded-xl"
          >
            <Bell className="size-4" />
            {props.newOrderCount > 0 ? (
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-red-500 ring-2 ring-white" />
            ) : null}
          </Button>

          <Avatar className="hidden size-9 sm:flex">
            <AvatarImage src={props.userAvatarUrl ?? undefined} alt={props.userName} />
            <AvatarFallback className="bg-zinc-950 text-xs text-white">
              {initials(props.userName) || "U"}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
