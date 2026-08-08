import Link from "next/link";
import { BookOpen, LifeBuoy, ShieldAlert } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <MarketingHeader />
      <main className="mx-auto max-w-5xl px-5 py-16 lg:px-8">
        <p className="text-sm font-medium text-amber-600">Estamos consigo</p>
        <h1 className="mt-3 text-5xl font-semibold tracking-tight">
          Suporte Trimos
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-500">
          Para conseguirmos ajudar depressa, indique o restaurante, a página
          onde ocorreu e o horário aproximado.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              title: "Dúvida operacional",
              text: "Configuração, produtos, horários, pedidos, reservas ou estafetas.",
              icon: BookOpen,
            },
            {
              title: "Faturação",
              text: "Plano, cobrança ou acesso ao portal seguro da Stripe.",
              icon: LifeBuoy,
            },
            {
              title: "Incidente urgente",
              text: "Falha que impeça receber pedidos ou operar o restaurante.",
              icon: ShieldAlert,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="border-zinc-200 shadow-none">
                <CardContent className="p-6">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-zinc-950 text-amber-400">
                    <Icon className="size-5" />
                  </div>
                  <h2 className="mt-5 text-lg font-semibold">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    {item.text}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="mt-10 rounded-3xl bg-zinc-950 p-8 text-white">
          <h2 className="text-2xl font-semibold">Precisa de contacto?</h2>
          <p className="mt-2 text-zinc-400">
            Use o formulário seguro. O pedido ficará registado no painel da
            equipa Trimos.
          </p>
          <Button
            render={<Link href="/contact" />}
            nativeButton={false}
            className="mt-5 bg-amber-400 text-zinc-950 hover:bg-amber-300"
          >
            Abrir contacto
          </Button>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
