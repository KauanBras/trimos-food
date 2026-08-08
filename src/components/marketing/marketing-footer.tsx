import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 text-sm text-zinc-500 sm:grid-cols-2 lg:px-8">
        <div>
          <p className="font-semibold text-zinc-950">Trimos Food</p>
          <p className="mt-2 max-w-sm leading-6">
            Operação digital para restaurantes: pedidos, reservas, clientes,
            pagamentos e entregas.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 sm:justify-end">
          <Link href="/terms">Termos</Link>
          <Link href="/privacy">Privacidade</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/support">Suporte</Link>
          <Link href="/contact">Contacto comercial</Link>
        </div>
        <p className="text-xs text-zinc-400 sm:col-span-2">
          © {new Date().getFullYear()} Trimos Food. Todos os direitos
          reservados.
        </p>
      </div>
    </footer>
  );
}
