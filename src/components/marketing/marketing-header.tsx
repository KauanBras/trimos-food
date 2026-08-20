import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";

import { Button } from "@/components/ui/button";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-semibold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-zinc-950 text-amber-400">
            <UtensilsCrossed className="size-4" />
          </span>
          Trimos Food
        </Link>
        <nav className="ml-auto hidden items-center gap-6 text-sm text-zinc-600 md:flex">
          <Link href="/#produto" className="hover:text-zinc-950">
            Produto
          </Link>
          <Link href="/pricing" className="hover:text-zinc-950">
            Preços
          </Link>
          <Link href="/r/hirotatsu-sushi-demo" className="hover:text-zinc-950">
            Demonstração
          </Link>
          <Link href="/contact" className="hover:text-zinc-950">
            Contacto
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Button
            render={<Link href="/login" />}
            nativeButton={false}
            variant="ghost"
          >
            Entrar
          </Button>
          <Button
            render={<Link href="/contact" />}
            nativeButton={false}
            className="bg-amber-400 text-zinc-950 hover:bg-amber-300"
          >
            Pedir demonstração
          </Button>
        </div>
      </div>
    </header>
  );
}
