"use client";

import {
  Bell,
  Menu,
  Search,
  Zap,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

export function RestaurantTopbar() {
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
            <RestaurantSidebar />
          </SheetContent>
        </Sheet>

        <div className="relative hidden max-w-md flex-1 md:block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Procurar pedidos, clientes ou reservas..."
            className="h-10 border-zinc-200 bg-zinc-50 pl-9 shadow-none"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Badge
            variant="outline"
            className="hidden h-9 gap-2 rounded-xl border-emerald-200 bg-emerald-50 px-3 text-emerald-700 sm:flex"
          >
            <span className="size-2 rounded-full bg-emerald-500" />
            Aberto há 3h 24m
          </Badge>

          <Button variant="outline" className="hidden gap-2 rounded-xl sm:flex">
            <Zap className="size-4" />
            Modo operação
          </Button>

          <Button variant="outline" size="icon" className="relative rounded-xl">
            <Bell className="size-4" />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500 ring-2 ring-white" />
          </Button>

          <div className="hidden items-center gap-3 pl-1 sm:flex">
            <Avatar className="size-9">
              <AvatarFallback className="bg-zinc-950 text-xs text-white">
                KB
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>
    </header>
  );
}
