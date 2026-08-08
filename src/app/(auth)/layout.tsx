import { Store } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-zinc-50 lg:grid-cols-2">
      <section className="hidden bg-zinc-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-400 text-zinc-950">
            <Store className="size-5" />
          </div>

          <div>
            <p className="font-semibold">Trimos Food</p>
            <p className="text-sm text-zinc-400">
              Gestão completa para restaurantes
            </p>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="text-sm font-medium text-amber-400">
            Pedidos, entregas e reservas
          </p>

          <h1 className="mt-4 text-5xl font-semibold leading-tight tracking-tight">
            Toda a operação do restaurante num único lugar.
          </h1>

          <p className="mt-6 max-w-lg leading-7 text-zinc-400">
            Controle pedidos, cozinha, estafetas e reservas em tempo real.
          </p>
        </div>

        <p className="text-sm text-zinc-500">
          Trimos Food · Operação inteligente para restaurantes
        </p>
      </section>

      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
